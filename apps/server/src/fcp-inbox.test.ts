import {
  FCP_VERSION,
  inboxListMethod,
  runStartMethod,
} from "@workspace/contracts"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { openFcpWs, startFcpServer } from "./fcp-harness.ts"

function writeApprovalWorkflow(home: string): void {
  const dir = join(home, "workflows", "ask")
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    `id: ask
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: gate, kind: approval, question: Ship it? }
  - { id: after, kind: command, run: "echo ok" }
edges:
  - { from: t, to: gate }
  - { from: gate, to: after }
`
  )
}

describe("inbox/* over /fcp", () => {
  it("lists a waiting approval and answer clears it", async () => {
    const h = await startFcpServer()
    writeApprovalWorkflow(h.home)

    const socket = await openFcpWs(h.port, h.token)
    const peer = new RpcPeer(wsTransport(socket))
    await peer.request("initialize", {
      protocolVersion: FCP_VERSION,
      clientInfo: { name: "fcp-inbox-test", version: "0.0.0" },
      clientCapabilities: {},
    })
    const runId = runStartMethod.result.parse(
      await peer.request("run/start", {
        workflowId: "ask",
        requestKey: randomUUID(),
      })
    ).runId

    const deadline = Date.now() + 10_000
    let listed = inboxListMethod.result.parse(
      await peer.request("inbox/list", {})
    )
    while (listed.items.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50))
      listed = inboxListMethod.result.parse(
        await peer.request("inbox/list", {})
      )
    }
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]).toMatchObject({
      kind: "approval",
      runId,
      question: "Ship it?",
      status: "open",
    })
    const itemId = listed.items[0]!.id

    await peer.request("inbox/answer", { itemId, optionId: "approved" })
    const after = inboxListMethod.result.parse(
      await peer.request("inbox/list", {})
    )
    expect(after.items).toEqual([])

    socket.close()
  })
})
