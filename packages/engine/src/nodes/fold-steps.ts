import type { EngineEvent } from "@workspace/shared"

/** Step states (DES-034). */
export type StepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled"

export type StepFailReason =
  | "exit"
  | "timeout"
  | "unclear"
  | "answer"
  | "loop_limit"

/** One pass of one node. */
export type StepState = {
  nodeId: string
  pass: number
  status: StepStatus
  /** Attempts started in this pass (retries). */
  attempts: number
  outputs?: string[]
  branch?: string
  answer?: Record<string, unknown>
  failReason?: StepFailReason
  /** Position in the event log; later steps are newer. */
  seq: number
}

export type StepsState = {
  /** Steps per node id, one entry per pass in pass order. */
  steps: Record<string, StepState[]>
  /** Run ended: no step changes after `run_succeeded|failed|cancelled`. */
  ended: boolean
}

const OPEN: ReadonlySet<StepStatus> = new Set(["pending", "running", "waiting"])

export function isOpenStep(step: StepState): boolean {
  return OPEN.has(step.status)
}

/** Latest pass of a node, if any step exists. */
export function latestStep(
  state: StepsState,
  nodeId: string
): StepState | undefined {
  const list = state.steps[nodeId]
  return list?.[list.length - 1]
}

function stepFor(
  state: StepsState,
  nodeId: string,
  pass: number
): StepState | undefined {
  return state.steps[nodeId]?.find((s) => s.pass === pass)
}

function ensureStep(
  state: StepsState,
  nodeId: string,
  pass: number,
  seq: number
): StepState {
  let step = stepFor(state, nodeId, pass)
  if (!step) {
    step = { nodeId, pass, status: "pending", attempts: 0, seq }
    const list = (state.steps[nodeId] ??= [])
    list.push(step)
    list.sort((a, b) => a.pass - b.pass)
  }
  return step
}

/** Pure fold of one node run's events into steps per node and pass. */
export function foldSteps(events: readonly EngineEvent[]): StepsState {
  const state: StepsState = { steps: {}, ended: false }
  events.forEach((event, i) => {
    const seq = i + 1
    switch (event.type) {
      case "step_started": {
        const s = ensureStep(state, event.nodeId, event.pass, seq)
        s.status = "running"
        s.seq = seq
        return
      }
      case "attempt_started": {
        if (!event.nodeId) return
        const s = ensureStep(state, event.nodeId, event.pass ?? 1, seq)
        s.attempts = Math.max(s.attempts, event.attempt)
        s.status = "running"
        return
      }
      case "approval_requested": {
        const s = latestStep(state, event.taskId)
        if (s && s.status === "running") s.status = "waiting"
        return
      }
      case "step_approved": {
        const s = stepFor(state, event.nodeId, event.pass)
        if (s && s.status === "waiting") s.status = "running"
        return
      }
      case "step_done": {
        const s = ensureStep(state, event.nodeId, event.pass, seq)
        s.status = "done"
        s.outputs = event.outputs
        s.branch = event.branch
        s.answer = event.answer
        s.seq = seq
        return
      }
      case "step_failed": {
        const s = ensureStep(state, event.nodeId, event.pass, seq)
        s.status = "failed"
        s.failReason = event.reason
        s.seq = seq
        return
      }
      case "step_skipped": {
        const s = ensureStep(state, event.nodeId, event.pass, seq)
        s.status = "skipped"
        s.seq = seq
        return
      }
      case "step_rejected":
      case "step_cancelled": {
        const s = ensureStep(state, event.nodeId, event.pass, seq)
        s.status = "cancelled"
        s.seq = seq
        return
      }
      case "step_retry_requested": {
        const s = stepFor(state, event.nodeId, event.pass)
        if (!s) return
        s.status = "pending"
        s.failReason = undefined
        s.outputs = undefined
        s.branch = undefined
        s.answer = undefined
        s.seq = seq
        state.ended = false
        return
      }
      case "run_succeeded":
      case "run_failed":
      case "run_cancelled":
        state.ended = true
        return
      default:
        return
    }
  })
  return state
}
