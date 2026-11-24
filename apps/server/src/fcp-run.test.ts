import {
  FCP_VERSION,
  runGetMethod,
  runListMethod,
  runStartMethod,
  runUpdateNotification,
  subscribeMethod,
} from "@workspace/contracts"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { WebSocket } from "ws"
import { openFcpWs, startFcpServer } from "./fcp-harness.ts"

function writeDemoWorkflow(home: string): void {
  const dir = join(home, "workflows", "demo")
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    `
id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "printf hi > \\"$NODE_OUT/out.txt\\""
edges:
  - { from: t, to: a }
`
  )
}

async function fcpPeer(
  port: number,
  token: string
): Promise<{ peer: RpcPeer; socket: WebSocket }> {
  const socket = await openFcpWs(port, token)
  const peer = new RpcPeer(wsTransport(socket))
  await peer.request("initialize", {
    protocolVersion: FCP_VERSION,
    clientInfo: { name: "fcp-run-test", version: "0.0.0" },
    clientCapabilities: {},
  })
  return { peer, socket }
}

async function startRunViaFcp(
  port: number,
  token: string,
  workflowId: string
): Promise<string> {
  const { peer, socket } = await fcpPeer(port, token)
  const started = runStartMethod.result.parse(
    await peer.request("run/start", {
      workflowId,
      requestKey: randomUUID(),
    })
  )
  socket.close()
  return started.runId
}

describe("FCP run/list, run/get and run_changed", () => {
  it("lists and gets run summaries over FCP", async () => {
    const h = await startFcpServer()
    writeDemoWorkflow(h.home)
    const firstId = await startRunViaFcp(h.port, h.token, "demo")
    const secondId = await startRunViaFcp(h.port, h.token, "demo")

    const { peer, socket } = await fcpPeer(h.port, h.token)

    const listed = runListMethod.result.parse(
      await peer.request("run/list", { limit: 10 })
    )
    expect(listed.items.map((r) => r.id)).toEqual(
      expect.arrayContaining([firstId, secondId])
    )

    const got = runGetMethod.result.parse(
      await peer.request("run/get", { id: firstId })
    )
    expect(got.id).toBe(firstId)
    expect(got.workflowId).toBe("demo")

    const page = runListMethod.result.parse(
      await peer.request("run/list", { limit: 1 })
    )
    expect(page.items).toHaveLength(1)
    expect(page.next).toBe(page.items[0]!.id)
    const rest = runListMethod.result.parse(
      await peer.request("run/list", { cursor: page.next, limit: 10 })
    )
    expect(rest.items.map((r) => r.id)).not.toContain(page.items[0]!.id)

    socket.close()
  })

  it("publishes run/update run_changed when a run starts via FCP", async () => {
    const h = await startFcpServer()
    writeDemoWorkflow(h.home)

    const { peer, socket } = await fcpPeer(h.port, h.token)

    const updates: unknown[] = []
    peer.onNotification("run/update", (params) => {
      updates.push(params)
    })
    subscribeMethod.result.parse(
      await peer.request("subscribe", { topics: ["run"] })
    )

    const runId = runStartMethod.result.parse(
      await peer.request("run/start", {
        workflowId: "demo",
        requestKey: randomUUID(),
      })
    ).runId

    const deadline = Date.now() + 10_000
    while (
      !updates.some((u) => {
        const parsed = runUpdateNotification.params.safeParse(u)
        return (
          parsed.success &&
          parsed.data.kind === "run_changed" &&
          parsed.data.runId === runId
        )
      })
    ) {
      if (Date.now() > deadline) {
        throw new Error("timed out waiting for run_changed")
      }
      await new Promise((r) => setTimeout(r, 25))
    }

    const match = updates
      .map((u) => runUpdateNotification.params.parse(u))
      .find((u) => u.kind === "run_changed" && u.runId === runId)
    expect(match?.kind).toBe("run_changed")
    if (match?.kind === "run_changed") {
      expect(match.summary?.id).toBe(runId)
      expect(match.seq).toBeGreaterThan(0)
    }

    socket.close()
  })
})

describe("FCP run/list by workflow and run/get steps (BL-203)", () => {
  it("filters run/list by workflowId and returns steps on run/get", async () => {
    const h = await startFcpServer()
    writeDemoWorkflow(h.home)
    const runId = await startRunViaFcp(h.port, h.token, "demo")
    const { peer, socket } = await fcpPeer(h.port, h.token)

    const listed = runListMethod.result.parse(
      await peer.request("run/list", { workflowId: "demo", limit: 50 })
    )
    expect(listed.items.map((r) => r.id)).toContain(runId)
    expect(listed.items.every((r) => r.workflowId === "demo")).toBe(true)

    const empty = runListMethod.result.parse(
      await peer.request("run/list", { workflowId: "missing", limit: 50 })
    )
    expect(empty.items).toEqual([])

    const got = runGetMethod.result.parse(
      await peer.request("run/get", { id: runId })
    )
    expect(got.id).toBe(runId)
    expect(got.steps?.length).toBeGreaterThan(0)
    expect(got.steps?.[0]).toMatchObject({
      nodeId: expect.any(String),
      kind: expect.any(String),
      status: expect.any(String),
    })

    socket.close()
  })
})

describe("FCP run/start and run/list with a card (BL-200)", () => {
  it("starts with a docket card id and filters run/list by cardId", async () => {
    const h = await startFcpServer()
    writeDemoWorkflow(h.home)
    const cardId = "fix-login"
    mkdirSync(join(h.home, "docket", "cards", cardId), { recursive: true })
    writeFileSync(
      join(h.home, "docket", "cards", cardId, "card.md"),
      [
        "---",
        `id: ${cardId}`,
        "title: Fix flaky login",
        "status: doing",
        "created: 2026-11-01",
        "updated: 2026-11-01",
        "---",
        "",
      ].join("\n")
    )

    const { peer, socket } = await fcpPeer(h.port, h.token)
    const started = runStartMethod.result.parse(
      await peer.request("run/start", {
        workflowId: "demo",
        requestKey: randomUUID(),
        cardId: cardId,
      })
    )
    const otherId = await startRunViaFcp(h.port, h.token, "demo")

    const listed = runListMethod.result.parse(
      await peer.request("run/list", { cardId: cardId, limit: 50 })
    )
    expect(listed.items.map((r) => r.id)).toEqual([started.runId])
    expect(listed.items[0]?.cardId).toBe(cardId)
    expect(listed.items.map((r) => r.id)).not.toContain(otherId)

    socket.close()
  })
})
