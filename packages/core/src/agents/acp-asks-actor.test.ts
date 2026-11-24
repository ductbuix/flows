import { describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/contracts"
import { createInboxService } from "../inbox/service.ts"
import { createNodeEffectRunner } from "../nodes/run.ts"
import type { StoredEvent } from "../ports/event-store.ts"
import { RunActor } from "../runs/actor.ts"
import { createFakeAgentRuntime } from "../testing/fake-agent-runtime.ts"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createFakeEventStore } from "../testing/fake-event-store.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createAcpAsks } from "./acp-asks.ts"
import { selectedPermissionResult } from "./permission-ask.ts"

describe("ACP asks on RunActor (BL-195)", () => {
  it("parks a permission ask and resumes after inbox answer", async () => {
    const events = createFakeEventStore()
    const docs = createFakeDocumentStore()
    docs.write("workflows/wf/runs/r1/nodes/l/frozen/prompt.md", "Go.\n")
    const bus = new UpdateBus()
    const clock = { now: () => Date.now() }

    const inboxRef: { apply?: (s: StoredEvent) => void } = {}
    const asks = createAcpAsks({
      clock,
      append: (event) => {
        const list = events.read(event.runId)
        const expectSeq = list[list.length - 1]?.seq ?? 0
        const result = events.append(event.runId, [event], { expectSeq })
        if (!result.ok) throw new Error("append conflict")
        for (const s of result.appended) inboxRef.apply?.(s)
      },
    })

    const inbox = createInboxService({
      bus,
      clock,
      events,
      pushAnswer: async (input) => {
        if (input.kind === "approval" || !input.requestId) {
          throw new Error("expected acp answer")
        }
        if (
          !asks.answer({
            kind: input.kind,
            runId: input.runId,
            at: input.at,
            nodeId: input.nodeId,
            pass: input.pass,
            requestId: input.requestId,
            optionId: input.optionId,
          })
        ) {
          throw new Error("no live ask")
        }
      },
    })
    inboxRef.apply = (s) => {
      inbox.apply(s)
    }

    const runtime = createFakeAgentRuntime().onPrompt(async function* (p) {
      const result = await p.spec.handlePermission?.({
        toolCall: {
          toolCallId: "tc1",
          title: "Write file",
          kind: "edit",
          status: "pending",
        },
      })
      expect(result).toEqual(selectedPermissionResult("allow-once"))
      yield { kind: "message_chunk", text: "ok" }
      yield { kind: "stop", reason: "end_turn" }
    })

    const runEffect = createNodeEffectRunner({
      docs,
      agentRuntime: runtime,
      acpAsks: asks.gates,
      runDirOf: () => "workflows/wf/runs/r1",
      agentCwdOf: () => "/tmp/step",
    })

    const actor = new RunActor("r1", { events, runEffect })
    const graph = workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        { id: "l", kind: "llm", cli: "cursor" },
      ],
      edges: [{ from: "t", to: "l" }],
    })

    const started = actor.push({
      kind: "start",
      at: new Date().toISOString(),
      runId: "r1",
      graph,
    })

    const deadline = Date.now() + 5_000
    while (inbox.openItems().length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(inbox.openItems()).toHaveLength(1)
    expect(inbox.openItems()[0]?.kind).toBe("permission")

    await inbox.answer(inbox.openItems()[0]!.id, "allow-once")
    await started

    expect(actor.getState()?.status).toBe("succeeded")
    asks.cancelAll()
  })
})
