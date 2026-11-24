import type { EngineEvent } from "@workspace/contracts"
import {
  emptySteps,
  type AttemptInfo,
  type StepFailReason,
  type StepState,
  type StepsState,
} from "./model.ts"

function stepFor(
  steps: StepsState,
  nodeId: string,
  pass: number
): StepState | undefined {
  return steps.steps[nodeId]?.find((s) => s.pass === pass)
}

function withStep(
  steps: StepsState,
  nodeId: string,
  pass: number,
  seq: number,
  update: (s: StepState) => StepState
): StepsState {
  const list = steps.steps[nodeId] ?? []
  const idx = list.findIndex((s) => s.pass === pass)
  const base: StepState =
    idx >= 0
      ? list[idx]!
      : { nodeId, pass, status: "pending", attempts: 0, seq }
  const next = update(base)
  const nextList =
    idx >= 0
      ? list.map((s, i) => (i === idx ? next : s))
      : [...list, next].sort((a, b) => a.pass - b.pass)
  return { ...steps, steps: { ...steps.steps, [nodeId]: nextList } }
}

function setAttempt(
  current: AttemptInfo | undefined,
  attempt: number,
  patch: Partial<AttemptInfo>
): AttemptInfo | undefined {
  if (!current || current.attempt !== attempt) return current
  return { ...current, ...patch }
}

/** Pure fold of one event into step state (DES-041). */
export function foldSteps(
  state: StepsState,
  event: EngineEvent,
  seq: number
): StepsState {
  switch (event.type) {
    case "step_started":
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "running",
        seq,
      }))
    case "attempt_started": {
      if (!event.nodeId) return state
      const pass = event.pass ?? 1
      return withStep(state, event.nodeId, pass, seq, (s) => ({
        ...s,
        attempts: Math.max(s.attempts, event.attempt),
        status: "running",
        current: { attempt: event.attempt, startedAt: event.at, open: true },
      }))
    }
    case "attempt_launched": {
      if (!event.nodeId) return state
      return withStep(state, event.nodeId, event.pass ?? 1, seq, (s) => ({
        ...s,
        current: setAttempt(s.current, event.attempt, {
          pid: event.pid,
          timeout: event.timeout,
          model: event.model,
          effort: event.effort,
          modelSource: event.modelSource,
        }),
      }))
    }
    case "attempt_finished":
    case "attempt_interrupted": {
      if (!event.nodeId) return state
      return withStep(state, event.nodeId, event.pass ?? 1, seq, (s) => ({
        ...s,
        current: setAttempt(s.current, event.attempt, {
          open: false,
          endedAt: event.at,
          ...(event.type === "attempt_finished"
            ? { exitCode: event.exitCode, reason: event.reason }
            : { interrupted: true }),
        }),
      }))
    }
    case "approval_requested": {
      const nodeId = event.nodeId ?? event.taskId
      const pass = event.pass ?? 1
      const cur = stepFor(state, nodeId, pass)
      if (!cur || cur.status !== "running") return state
      return withStep(state, nodeId, pass, seq, (s) => ({
        ...s,
        status: "waiting",
        waitingKind: "approval",
        ...(event.question !== undefined ? { question: event.question } : {}),
      }))
    }
    case "permission_requested": {
      const cur = stepFor(state, event.nodeId, event.pass)
      if (!cur || (cur.status !== "running" && cur.status !== "waiting")) {
        return state
      }
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "waiting",
        waitingKind: "permission",
        ...(event.question !== undefined ? { question: event.question } : {}),
      }))
    }
    case "permission_answered":
    case "question_answered": {
      const cur = stepFor(state, event.nodeId, event.pass)
      if (!cur || cur.status !== "waiting") return state
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "running",
        waitingKind: undefined,
        question: undefined,
      }))
    }
    case "question_asked": {
      const cur = stepFor(state, event.nodeId, event.pass)
      if (!cur || (cur.status !== "running" && cur.status !== "waiting")) {
        return state
      }
      const display =
        event.title ?? event.questions.map((q) => q.prompt).join(" · ")
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "waiting",
        waitingKind: "question",
        question: display,
      }))
    }
    case "step_approved": {
      const cur = stepFor(state, event.nodeId, event.pass)
      if (!cur || cur.status !== "waiting") return state
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "running",
        waitingKind: undefined,
        decision: "approved",
      }))
    }
    case "step_done":
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "done",
        outputs: event.outputs,
        branch: event.branch,
        answer: event.answer,
        reused: event.reused,
        seq,
      }))
    case "step_failed":
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "failed",
        failReason: event.reason as StepFailReason,
        seq,
      }))
    case "step_skipped":
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "skipped",
        reused: event.reused,
        seq,
      }))
    case "step_rejected":
    case "step_cancelled":
      return withStep(state, event.nodeId, event.pass, seq, (s) => ({
        ...s,
        status: "cancelled",
        ...(event.type === "step_rejected"
          ? { decision: "rejected" as const }
          : {}),
        seq,
      }))
    case "step_retry_requested": {
      if (!stepFor(state, event.nodeId, event.pass)) return state
      return {
        ...withStep(state, event.nodeId, event.pass, seq, (s) => ({
          nodeId: s.nodeId,
          pass: s.pass,
          status: "pending",
          attempts: s.attempts,
          seq,
        })),
        ended: false,
      }
    }
    case "run_succeeded":
    case "run_failed":
    case "run_cancelled":
      return { ...state, ended: true }
    default:
      return state
  }
}

/** Fold a list of events from empty steps (test helper). */
export function foldAllSteps(events: readonly EngineEvent[]): StepsState {
  return events.reduce((s, e, i) => foldSteps(s, e, i + 1), emptySteps())
}
