import { activeInputs, effectForRun } from "./decide-effects.ts"
import { scheduleNext } from "./decide-next.ts"
import {
  isOpenStep,
  retryMax,
  type DecideOutput,
  type RunState,
  type StepState,
} from "./model.ts"
import type { EngineEvent } from "@workspace/contracts"

const DEFAULT_RETRY_BACKOFF_MS = 2000

/** Cancel open steps then end the run. */
export function decideCancel(state: RunState, at: string): DecideOutput {
  if (state.steps.ended) return { events: [], effects: [] }
  const events: EngineEvent[] = []
  if (!state.cancelRequested) {
    events.push({ type: "cancel_requested", runId: state.runId, at })
  }
  const rejected = Object.values(state.steps.steps)
    .flat()
    .some((s) => s.decision === "rejected")
  for (const list of Object.values(state.steps.steps)) {
    for (const s of list) {
      if (!isOpenStep(s)) continue
      events.push({
        type: "step_cancelled",
        runId: state.runId,
        at,
        nodeId: s.nodeId,
        pass: s.pass,
      })
    }
  }
  events.push({
    type: "run_cancelled",
    runId: state.runId,
    at,
    ...(rejected ? { reason: "rejected" as const } : {}),
  })
  return { events, effects: [] }
}

/**
 * One scheduling pass: settle closed attempts, recover bare running
 * steps, then take the first walk action (ported from nodes/tick).
 */
export function decideWake(
  state: RunState,
  at: string,
  retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS
): DecideOutput {
  if (state.steps.ended || state.status === "queued") {
    return { events: [], effects: [] }
  }
  if (state.cancelRequested) return decideCancel(state, at)

  const approved = findStep(
    state,
    (s) => s.status === "running" && s.decision === "approved"
  )
  if (approved) {
    return {
      events: [],
      effects: [
        {
          kind: "launch_step",
          nodeId: approved.nodeId,
          pass: approved.pass,
          attempt: Math.max(1, approved.attempts),
        },
      ],
    }
  }

  const closed = findStep(
    state,
    (s) => s.status === "running" && !!s.current && !s.current.open
  )
  if (closed) return settleClosedAttempt(state, closed, at, retryBackoffMs)

  const bare = findStep(
    state,
    (s) => s.status === "running" && s.decision !== "approved" && !s.current
  )
  if (bare) {
    const inputs = activeInputs(state, bare.nodeId)
    return {
      events: [],
      effects: [
        effectForRun(
          state,
          bare.nodeId,
          bare.pass,
          inputs,
          Math.max(1, bare.attempts)
        ),
      ],
    }
  }

  return scheduleNext(state, at)
}

function findStep(
  state: RunState,
  pred: (s: StepState) => boolean
): StepState | undefined {
  for (const list of Object.values(state.steps.steps)) {
    for (const s of list) if (pred(s)) return s
  }
  return undefined
}

function settleClosedAttempt(
  state: RunState,
  step: StepState,
  at: string,
  retryBackoffMs: number
): DecideOutput {
  const c = step.current!
  if (!c.interrupted && c.exitCode === 0) {
    return { events: [], effects: [] }
  }
  const node = state.graph.nodes.find((n) => n.id === step.nodeId)
  const max = node ? retryMax(node) : undefined
  if (max !== undefined && step.attempts < max) {
    const endedAt = c.endedAt ?? at
    const wait = retryBackoffMs * 2 ** (step.attempts - 1)
    if (Date.parse(at) < Date.parse(endedAt) + wait) {
      return { events: [], effects: [] }
    }
    const inputs = activeInputs(state, step.nodeId)
    return {
      events: [],
      effects: [
        effectForRun(state, step.nodeId, step.pass, inputs, step.attempts + 1),
      ],
    }
  }
  return {
    events: [
      {
        type: "step_failed",
        runId: state.runId,
        at,
        nodeId: step.nodeId,
        pass: step.pass,
        reason: c.reason === "timeout" ? "timeout" : "exit",
      },
    ],
    effects: [],
  }
}
