import type { EngineEvent } from "@workspace/contracts"
import {
  createInboxService,
  createPlanReviewGate,
  planReviewItemId,
  UpdateBus,
  type PlanReviewGate,
} from "@workspace/core"
import { createFakeClock, createFakeEventStore } from "@workspace/core/testing"
import { ACP_CLIENT_CAPABILITIES } from "./session.ts"
import type { FakeAgentStep } from "./testing/fake-agent.ts"

export const clientInfo = { name: "flows-test", version: "0.0.0" }
export const sessionId = "sess_plan"
export const cwd = "/tmp/work"
export const at = "2026-11-24T00:00:00.000Z"
export const runId = "r1"
export const nodeId = "llm"
export const pass = 1

export const planParams = {
  toolCallId: "call_124",
  name: "Refactor tabs",
  overview: "Tighten layout behavior",
  plan: "1. Inspect sizing.\n2. Update layout.",
  todos: [
    { id: "todo-1", content: "Inspect sizing", status: "completed" as const },
    { id: "todo-2", content: "Update layout", status: "pending" as const },
  ],
  isProject: false,
}

export function setupSteps(promptStep: FakeAgentStep): FakeAgentStep[] {
  return [
    {
      expect: {
        method: "initialize",
        params: {
          protocolVersion: 1,
          clientCapabilities: ACP_CLIENT_CAPABILITIES,
          clientInfo,
        },
      },
      reply: {
        result: {
          protocolVersion: 1,
          agentCapabilities: {},
          agentInfo: { name: "fake", version: "0" },
          authMethods: [],
        },
      },
    },
    {
      expect: {
        method: "session/new",
        params: { cwd, mcpServers: [] },
      },
      reply: { result: { sessionId } },
    },
    promptStep,
  ]
}

export async function waitFor(fn: () => void, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  let last: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      fn()
      return
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 10))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

export function seedAskRun() {
  const events = createFakeEventStore()
  const clock = createFakeClock(Date.parse(at))
  const bus = new UpdateBus()
  events.append(
    runId,
    [
      {
        type: "run_started",
        runId,
        at,
        workflowId: "wf",
        graph: {
          id: "wf",
          nodes: [
            { id: "t", kind: "trigger", type: "manual" },
            { id: nodeId, kind: "llm", cli: "cursor", planReview: "ask" },
          ],
          edges: [{ from: "t", to: nodeId }],
        },
        trigger: "t",
      },
      { type: "step_started", runId, at, nodeId, pass },
    ],
    { expectSeq: 0 }
  )
  return { events, clock, bus }
}

export function wirePlanReviewInbox(
  events: ReturnType<typeof createFakeEventStore>,
  clock: ReturnType<typeof createFakeClock>,
  bus: UpdateBus,
  onApply?: (ev: EngineEvent) => void
): {
  gate: PlanReviewGate
  inbox: ReturnType<typeof createInboxService>
} {
  const box: { inbox?: ReturnType<typeof createInboxService> } = {}
  const appendAndApply = (ev: EngineEvent) => {
    const last = events.read(runId).at(-1)?.seq ?? 0
    const result = events.append(runId, [ev], { expectSeq: last })
    if (!result.ok) throw new Error("append conflict")
    for (const s of result.appended) {
      box.inbox!.apply(s)
      onApply?.(s.event)
    }
  }
  const gate = createPlanReviewGate({
    clock,
    onRequested: (event) => {
      appendAndApply(event)
    },
  })
  box.inbox = createInboxService({
    bus,
    clock,
    events,
    pushAnswer: async (input) => {
      if (input.kind !== "plan_review" || !input.requestId) {
        throw new Error("expected plan_review answer")
      }
      if (input.optionId !== "accepted" && input.optionId !== "rejected") {
        throw new Error(`bad option ${input.optionId}`)
      }
      const itemId = planReviewItemId(
        input.runId,
        input.nodeId,
        input.pass,
        input.requestId
      )
      if (!gate.answer(itemId, input.optionId)) {
        throw new Error("gate rejected answer")
      }
      appendAndApply({
        type: "plan_review_answered",
        runId: input.runId,
        at: input.at,
        nodeId: input.nodeId,
        pass: input.pass,
        requestId: input.requestId,
        outcome: input.optionId,
      })
    },
  })
  const inbox = box.inbox
  for (const s of events.read(runId)) inbox.apply(s)
  return { gate, inbox }
}
