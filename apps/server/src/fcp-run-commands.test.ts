import {
  FCP_VERSION,
  runStartMethod,
  runUpdateNotification,
  subscribeMethod,
} from "@workspace/contracts"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
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

async function fcpPeer(port: number, token: string) {
  const socket = await openFcpWs(port, token, {
    Origin: `http://127.0.0.1:${port}`,
  })
  const peer = new RpcPeer(wsTransport(socket))
  await peer.request("initialize", {
    protocolVersion: FCP_VERSION,
    clientInfo: { name: "fcp-run-commands-test", version: "0.0.0" },
    clientCapabilities: {},
  })
  return { peer, socket }
}

describe("run commands over /fcp", () => {
  it("starts idempotently and emits step_state and run_finished", async () => {
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

    const requestKey = randomUUID()
    const first = runStartMethod.result.parse(
      await peer.request("run/start", {
        workflowId: "demo",
        requestKey,
      })
    )
    expect(first.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )

    const second = runStartMethod.result.parse(
      await peer.request("run/start", {
        workflowId: "demo",
        requestKey,
      })
    )
    expect(second.runId).toBe(first.runId)

    // Heavy kinds (run_finished) need a scoped topic; replay from seq 0.
    subscribeMethod.result.parse(
      await peer.request("subscribe", {
        topics: [`run:${first.runId}`],
        since: 0,
      })
    )

    const deadline = Date.now() + 15_000
    while (
      !updates.some((u) => {
        const p = runUpdateNotification.params.safeParse(u)
        return (
          p.success &&
          p.data.kind === "run_finished" &&
          p.data.runId === first.runId
        )
      })
    ) {
      if (Date.now() > deadline) {
        throw new Error("timed out waiting for run_finished")
      }
      await new Promise((r) => setTimeout(r, 25))
    }

    const kinds = new Set(
      updates
        .map((u) => runUpdateNotification.params.safeParse(u))
        .filter((p) => p.success)
        .map((p) => p.data.kind)
    )
    expect(kinds.has("run_changed")).toBe(true)
    expect(kinds.has("step_state")).toBe(true)
    expect(kinds.has("run_finished")).toBe(true)

    const log = await peer.request("run/get_log", {
      runId: first.runId,
      stepId: "a",
      attempt: 1,
      stream: "stdout",
    })
    expect(log).toMatchObject({ stream: "stdout", eof: true })

    await peer.request("run/delete", { runId: first.runId })
    socket.close()
  }, 20_000)

  it("cancels a live run", async () => {
    const h = await startFcpServer()
    const dir = join(h.home, "workflows", "slow")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      `
id: slow
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "sleep 60"
edges:
  - { from: t, to: a }
`
    )
    const { peer, socket } = await fcpPeer(h.port, h.token)
    const started = runStartMethod.result.parse(
      await peer.request("run/start", { workflowId: "slow" })
    )
    await peer.request("run/cancel", { runId: started.runId })
    const got = await peer.request("run/get", { id: started.runId })
    expect((got as { status: string }).status).toBe("cancelled")
    socket.close()
  }, 20_000)
})
