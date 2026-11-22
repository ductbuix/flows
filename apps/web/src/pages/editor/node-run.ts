import type { RunDetail, TaskStatus } from "@workspace/shared"
import type { NodeStatus } from "@/nodes/NodeFrame"

/** Run state of one node card (BL-086). */
export type NodeRunView = {
  status?: NodeStatus
  timer?: string
  result?: string
  /** Branch a Judge took: `yes` or `no`. */
  verdict?: string
}

const STATUS: Record<TaskStatus, NodeStatus | undefined> = {
  pending: undefined,
  awaiting_approval: "waiting",
  running: "running",
  succeeded: "done",
  failed: "failed",
  skipped: "skipped",
  cancelled: "cancelled",
}

export function nodeStatus(status: TaskStatus): NodeStatus | undefined {
  return STATUS[status]
}

/** "850ms", "3.2s", "1m 05s". */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`
}

/** A live run is one the Run button must not start again. */
export function isLive(run: RunDetail | null): boolean {
  return run?.status === "running" || run?.status === "queued"
}

/** Whether the workflow has a Trigger node to start from. */
export function hasTrigger(nodes: readonly { kind: string }[]): boolean {
  return nodes.some((n) => n.kind === "trigger")
}

export type StepTimes = Record<string, { start: number; end?: number }>

/** Notes when each step started and ended, as the snapshots arrive. */
export function trackTimes(
  times: StepTimes,
  run: RunDetail,
  now: number
): StepTimes {
  const next: StepTimes = { ...times }
  for (const t of run.tasks) {
    const prev = next[t.id]
    if (t.status === "running") {
      // A retry starts a new attempt.
      if (!prev || prev.end !== undefined) next[t.id] = { start: now }
    } else if (prev && prev.end === undefined) {
      next[t.id] = { start: prev.start, end: now }
    }
  }
  return next
}

/** Branch each Judge took or decision each Approval got, by node id; the latest pass wins. */
export function verdictsOf(steps: RunDetail["steps"]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of steps ?? []) {
    if (s.branch ?? s.decision) out[s.nodeId] = (s.branch ?? s.decision)!
    else delete out[s.nodeId]
  }
  return out
}
