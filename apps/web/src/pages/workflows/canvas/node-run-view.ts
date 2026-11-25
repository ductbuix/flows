import type { RunStep, TaskStatus } from "@workspace/contracts"
import type { RunState } from "./flow-kinds"

const STATUS: Record<TaskStatus, RunState | undefined> = {
  pending: undefined,
  awaiting_approval: "waiting",
  running: "running",
  succeeded: "done",
  failed: "failed",
  skipped: "skipped",
  cancelled: "failed",
}

export function stepToRunState(status: TaskStatus): RunState | undefined {
  return STATUS[status]
}

export type PassInfo = { pass: number; attempts: number }

export type StepView = {
  state: RunState
  result?: string
  failReason?: string
  /** Attempts of the latest pass. */
  attempts: number
  /** Latest pass number. */
  pass: number
  /** Every pass seen so far, oldest first. */
  passes: PassInfo[]
}

/** Map latest steps onto node ids for the canvas. */
export function statesFromSteps(
  steps: readonly RunStep[]
): Record<string, StepView> {
  const out: Record<string, StepView> = {}
  const ordered = [...steps].sort((a, b) => a.pass - b.pass)
  for (const s of ordered) {
    const state = stepToRunState(s.status)
    if (!state) continue
    const attempts = Math.max(1, s.attempts)
    const passes = [
      ...(out[s.nodeId]?.passes.filter((p) => p.pass !== s.pass) ?? []),
      { pass: s.pass, attempts },
    ]
    out[s.nodeId] = {
      state,
      attempts,
      pass: s.pass,
      passes,
      ...(s.failReason ? { failReason: s.failReason } : {}),
      ...(s.branch || s.decision || s.failReason
        ? { result: s.branch ?? s.decision ?? s.failReason }
        : {}),
    }
  }
  return out
}
