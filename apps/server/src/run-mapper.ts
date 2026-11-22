import {
  deriveAttemptKind,
  type RetrySpec,
  type RunDetail,
  type TaskView,
} from "@workspace/shared"
import type { RunState } from "@workspace/engine"

const TERMINAL = new Set(["succeeded", "failed", "skipped", "cancelled"])

function taskCounts(state: RunState) {
  const tasks = Object.values(state.tasks)
  return {
    total: tasks.length,
    finished: tasks.filter((t) => TERMINAL.has(t.status)).length,
    awaitingApproval: tasks.filter((t) => t.status === "awaiting_approval")
      .length,
  }
}

/** Nodes in graph order; the run view lists one task per node. */
export function topoTaskIds(state: RunState): string[] {
  return state.graph.nodes.map((n) => n.id)
}

export function toTaskViews(state: RunState): TaskView[] {
  return topoTaskIds(state).map((id) => {
    const taskState = state.tasks[id]
    const node = state.graph.nodes.find((n) => n.id === id) as RetrySpec | undefined
    const attempts = (taskState?.attempts ?? []).map((a, index) => ({
      attempt: a.attempt,
      pid: a.pid,
      exitCode: a.exitCode,
      interrupted: a.interrupted,
      reason: a.reason,
      kind: deriveAttemptKind(
        node ?? {},
        (taskState?.attempts ?? []).map((x) => ({
          attempt: x.attempt,
          exitCode: x.exitCode,
          interrupted: x.interrupted,
        })),
        index
      ),
      ...(a.model !== undefined ? { model: a.model } : {}),
      ...(a.effort !== undefined ? { effort: a.effort } : {}),
      ...(a.modelSource !== undefined ? { modelSource: a.modelSource } : {}),
    }))
    return {
      id,
      status: taskState?.status ?? "pending",
      attempts,
    }
  })
}

export function toRunDetail(
  state: RunState,
  opts: { startedAt: string; finishedAt?: string; lastSeq: number }
): RunDetail {
  return {
    id: state.runId,
    workflowId: state.workflowId,
    status: state.status,
    ...(state.workItemId !== undefined ? { workItemId: state.workItemId } : {}),
    startedAt: opts.startedAt,
    finishedAt: opts.finishedAt,
    sandboxed: state.sandboxed,
    lastSeq: opts.lastSeq,
    graph: state.graph,
    tasks: toTaskViews(state),
    taskCounts: taskCounts(state),
    inputFiles: state.inputFiles ?? [],
    pins: [],
    effects: [],
  }
}

export function runTimestamps(events: Array<{ type: string; at: string }>): {
  startedAt: string
  finishedAt?: string
} {
  const started = events.find((e) => e.type === "run_started")
  const finished = [...events]
    .reverse()
    .find(
      (e) =>
        e.type === "run_succeeded" ||
        e.type === "run_failed" ||
        e.type === "run_cancelled"
    )
  return {
    startedAt: started?.at ?? new Date(0).toISOString(),
    finishedAt: finished?.at,
  }
}
