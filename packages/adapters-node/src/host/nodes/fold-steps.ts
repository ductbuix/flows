import type { Effort, EngineEvent, ModelSource } from "@workspace/contracts"

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
  | "conflict"
  | "rejected"

/** The latest attempt of a step (DES-034, Retry and Crash recovery). */
export type AttemptInfo = {
  attempt: number
  startedAt: string
  pid?: number
  timeout?: number
  /** Resolved model and effort of an agent attempt (DES-023). */
  model?: string
  effort?: Effort
  modelSource?: ModelSource
  /** True from `attempt_started` until finished or interrupted. */
  open: boolean
  exitCode?: number
  reason?: string
  interrupted?: boolean
  endedAt?: string
}

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
  /** Approval step: the question asked and the decision recorded (BL-080). */
  question?: string
  decision?: "approved" | "rejected"
  /** Latest attempt of a process step. */
  current?: AttemptInfo
  /** Copied from an earlier run by a partial run (BL-102). */
  reused?: boolean
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
        s.current = { attempt: event.attempt, startedAt: event.at, open: true }
        return
      }
      case "attempt_launched": {
        if (!event.nodeId) return
        const c = stepFor(state, event.nodeId, event.pass ?? 1)?.current
        if (c && c.attempt === event.attempt) {
          c.pid = event.pid
          c.timeout = event.timeout
          c.model = event.model
          c.effort = event.effort
          c.modelSource = event.modelSource
        }
        return
      }
      case "attempt_finished":
      case "attempt_interrupted": {
        if (!event.nodeId) return
        const c = stepFor(state, event.nodeId, event.pass ?? 1)?.current
        if (c && c.attempt === event.attempt) {
          c.open = false
          c.endedAt = event.at
          if (event.type === "attempt_finished") {
            c.exitCode = event.exitCode
            c.reason = event.reason
          } else {
            c.interrupted = true
          }
        }
        return
      }
      case "approval_requested": {
        const s = event.nodeId
          ? stepFor(state, event.nodeId, event.pass ?? 1)
          : latestStep(state, event.taskId)
        if (s && s.status === "running") {
          s.status = "waiting"
          if (event.question !== undefined) s.question = event.question
        }
        return
      }
      case "step_approved": {
        const s = stepFor(state, event.nodeId, event.pass)
        if (s && s.status === "waiting") {
          s.status = "running"
          s.decision = "approved"
        }
        return
      }
      case "step_done": {
        const s = ensureStep(state, event.nodeId, event.pass, seq)
        s.status = "done"
        s.outputs = event.outputs
        s.branch = event.branch
        s.answer = event.answer
        s.reused = event.reused
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
        s.reused = event.reused
        s.seq = seq
        return
      }
      case "step_rejected":
      case "step_cancelled": {
        const s = ensureStep(state, event.nodeId, event.pass, seq)
        s.status = "cancelled"
        if (event.type === "step_rejected") s.decision = "rejected"
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
        s.current = undefined
        s.question = undefined
        s.decision = undefined
        s.reused = undefined
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
