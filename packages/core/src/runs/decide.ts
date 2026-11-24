import type { EngineEvent } from "@workspace/contracts"
import {
  decideAnswer,
  decideEffectResult,
  decidePermissionAnswer,
  decideQuestionAnswer,
} from "./decide-result.ts"
import { decideCancel, decideWake } from "./decide-schedule.ts"
import type { DecideInput, DecideOutput, RunState } from "./model.ts"

/**
 * Pure decide: run rules with no I/O and no clock reads.
 * Time comes in `input.at` (DES-041, BL-131).
 */
export function decide(
  state: RunState | null,
  input: DecideInput
): DecideOutput {
  switch (input.kind) {
    case "start":
      return decideStart(input)
    case "wake":
      if (!state) return { events: [], effects: [] }
      return decideWake(state, input.at, input.retryBackoffMs)
    case "cancel":
      if (!state) return { events: [], effects: [] }
      return decideCancel(state, input.at)
    case "answer":
      if (!state) return { events: [], effects: [] }
      return decideAnswer(state, input)
    case "permission_answer":
      if (!state) return { events: [], effects: [] }
      return decidePermissionAnswer(state, input)
    case "question_answer":
      if (!state) return { events: [], effects: [] }
      return decideQuestionAnswer(state, input)
    case "effect_result":
      if (!state) return { events: [], effects: [] }
      return decideEffectResult(state, input)
    case "agent_event":
      return { events: [], effects: [] }
  }
}

function decideStart(
  input: Extract<DecideInput, { kind: "start" }>
): DecideOutput {
  const trigger =
    input.trigger ?? input.graph.nodes.find((n) => n.kind === "trigger")?.id
  const started: EngineEvent = {
    type: "run_started",
    runId: input.runId,
    at: input.at,
    workflowId: input.graph.id,
    graph: input.graph,
    source: "manual",
    ...(trigger ? { trigger } : {}),
    ...(input.only ? { only: input.only } : {}),
    ...(input.from ? { from: input.from } : {}),
    ...(input.queued ? { queued: true } : {}),
    ...(input.workItemId !== undefined ? { workItemId: input.workItemId } : {}),
  }
  return { events: [started, ...(input.seed ?? [])], effects: [] }
}
