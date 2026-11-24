import {
  FCP_VERSION,
  subscribeMethod,
  workflowCreateMethod,
  workflowGetMethod,
  workflowSaveMethod,
  workflowUpdateNotification,
  workflowValidateMethod,
} from "@workspace/contracts"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { openFcpWs, startFcpServer } from "./fcp-harness.ts"

async function fcpPeer(port: number, token: string) {
  const socket = await openFcpWs(port, token, {
    Origin: `http://127.0.0.1:${port}`,
  })
  const peer = new RpcPeer(wsTransport(socket))
  await peer.request("initialize", {
    protocolVersion: FCP_VERSION,
    clientInfo: { name: "fcp-workflow-write-test", version: "0.0.0" },
    clientCapabilities: {},
  })
  return { peer, socket }
}

function writeSlowWorkflow(home: string, id: string): void {
  const dir = join(home, "workflows", id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    `
id: ${id}
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "sleep 30"
edges:
  - { from: t, to: a }
`
  )
}

describe("workflow writes over /fcp", () => {
  it("creates, validates, saves, renames, deletes and emits updates", async () => {
    const h = await startFcpServer()
    const { peer, socket } = await fcpPeer(h.port, h.token)

    const updates: unknown[] = []
    peer.onNotification("workflow/update", (params) => {
      updates.push(params)
    })
    subscribeMethod.result.parse(
      await peer.request("subscribe", { topics: ["workflow"] })
    )

    const created = workflowCreateMethod.result.parse(
      await peer.request("workflow/create", {
        id: "alpha",
        goal: "first",
        name: "Alpha",
      })
    )
    expect(created).toEqual({
      id: "alpha",
      goal: "first",
      name: "Alpha",
      taskCount: 1,
    })

    const validated = workflowValidateMethod.result.parse(
      await peer.request("workflow/validate", {
        yaml: "id: bad\nnodes:\n  - { id: t, kind: nope }\nedges: []\n",
      })
    )
    expect(validated.workflow).toBeNull()
    expect(validated.errors.length).toBeGreaterThan(0)

    const detail = workflowGetMethod.result.parse(
      await peer.request("workflow/get", { id: "alpha" })
    )
    const nextYaml = detail.yaml.replace("goal: first", "goal: updated")
    const saved = workflowSaveMethod.result.parse(
      await peer.request("workflow/save", {
        id: "alpha",
        yaml: nextYaml,
        baseHash: detail.hash,
      })
    )
    expect(saved.workflow?.goal).toBe("updated")

    await expect(
      peer.request("workflow/save", {
        id: "alpha",
        yaml: nextYaml,
        baseHash: detail.hash,
      })
    ).rejects.toMatchObject({
      code: -32009,
      data: { code: "conflict" },
    })

    await peer.request("workflow/save_layout", {
      id: "alpha",
      layout: { version: 1, nodes: { start: { x: 10, y: 20 } } },
    })

    const renamed = await peer.request("workflow/rename", {
      id: "alpha",
      newId: "beta",
    })
    expect(renamed).toEqual({ id: "beta" })

    await peer.request("workflow/delete", { id: "beta" })
    await expect(
      peer.request("workflow/get", { id: "beta" })
    ).rejects.toMatchObject({
      data: { code: "not_found" },
    })

    const deadline = Date.now() + 5_000
    while (
      !updates.some((u) => {
        const p = workflowUpdateNotification.params.safeParse(u)
        return p.success && p.data.kind === "workflow_removed"
      })
    ) {
      if (Date.now() > deadline) {
        throw new Error("timed out waiting for workflow_removed")
      }
      await new Promise((r) => setTimeout(r, 25))
    }

    const kinds = updates
      .map((u) => workflowUpdateNotification.params.parse(u).kind)
      .sort()
    expect(kinds).toEqual(
      expect.arrayContaining([
        "workflow_changed",
        "layout_changed",
        "workflow_removed",
      ])
    )

    socket.close()
  })

  it("returns busy when deleting a workflow with a live run", async () => {
    const h = await startFcpServer()
    writeSlowWorkflow(h.home, "slow")
    const { peer, socket } = await fcpPeer(h.port, h.token)
    await peer.request("run/start", { workflowId: "slow" })
    await expect(
      peer.request("workflow/delete", { id: "slow" })
    ).rejects.toMatchObject({
      code: -32010,
      data: { code: "busy" },
    })
    socket.close()
  })
})
