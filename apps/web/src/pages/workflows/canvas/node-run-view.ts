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

/** Map latest steps onto node ids for the canvas. */
export function statesFromSteps(steps: readonly RunStep[]): Record<
  string,
  {
    state: RunState
    result?: string
    failReason?: string
    attempts: number
  }
> {
  const out: Record<
    string,
    {
      state: RunState
      result?: string
      failReason?: string
      attempts: number
    }
  > = {}
  for (const s of steps) {
    const state = stepToRunState(s.status)
    if (!state) continue
    out[s.nodeId] = {
      state,
      attempts: Math.max(1, s.attempts),
      ...(s.failReason ? { failReason: s.failReason } : {}),
      ...(s.branch || s.decision || s.failReason
        ? { result: s.branch ?? s.decision ?? s.failReason }
        : {}),
    }
  }
  return out
}
