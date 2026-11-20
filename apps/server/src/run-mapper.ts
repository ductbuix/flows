import {
  deriveAttemptKind,
  type RunDetail,
  type RunSummary,
  type TaskView,
} from "@workspace/shared"
import { needTaskId } from "@workspace/shared"
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

/** Topological order; spawned tasks stay under their parent when adjacent. */
export function topoTaskIds(state: RunState): string[] {
  const byId = new Map(state.graph.tasks.map((t) => [t.id, t]))
  const indegree = new Map<string, number>()
  const children = new Map<string, string[]>()
  for (const task of state.graph.tasks) {
    indegree.set(task.id, 0)
    children.set(task.id, [])
  }
  for (const task of state.graph.tasks) {
    for (const need of task.needs ?? []) {
      const parent = needTaskId(need)
      if (!indegree.has(parent) || !indegree.has(task.id)) continue
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1)
      children.get(parent)?.push(task.id)
    }
  }
  const queue = state.graph.tasks
    .filter((t) => (indegree.get(t.id) ?? 0) === 0)
    .map((t) => t.id)
  const ordered: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    ordered.push(id)
    for (const child of children.get(id) ?? []) {
      const next = (indegree.get(child) ?? 1) - 1
      indegree.set(child, next)
      if (next === 0) queue.push(child)
    }
  }
  for (const task of state.graph.tasks) {
    if (!ordered.includes(task.id)) ordered.push(task.id)
  }
  // Prefer spawned tasks immediately after their parent for list nesting.
  const withSpawn: string[] = []
  const placed = new Set<string>()
  for (const id of ordered) {
    if (placed.has(id)) continue
    const spec = byId.get(id)
    if (spec?.spawnedBy && !placed.has(spec.spawnedBy)) continue
    withSpawn.push(id)
    placed.add(id)
    for (const other of ordered) {
      if (placed.has(other)) continue
      if (byId.get(other)?.spawnedBy === id) {
        withSpawn.push(other)
        placed.add(other)
      }
    }
  }
  for (const id of ordered) {
    if (!placed.has(id)) withSpawn.push(id)
  }
  return withSpawn
}

export function toTaskViews(state: RunState): TaskView[] {
  return topoTaskIds(state).map((id) => {
    const taskState = state.tasks[id]
    const spec = state.graph.tasks.find((t) => t.id === id)
    const attempts = (taskState?.attempts ?? []).map((a, index) => ({
      attempt: a.attempt,
      pid: a.pid,
      exitCode: a.exitCode,
      interrupted: a.interrupted,
      kind: deriveAttemptKind(spec!, taskState!.attempts, index),
    }))
    return {
      id,
      status: taskState?.status ?? "pending",
      spawned: Boolean(spec?.spawnedBy),
      spawnedBy: spec?.spawnedBy,
      failReason: taskState?.failReason,
      skipReason: taskState?.skipReason,
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
    startedAt: opts.startedAt,
    finishedAt: opts.finishedAt,
    // Sandboxing is BL-010; until then every run is unrestricted.
    sandboxed: false,
    lastSeq: opts.lastSeq,
    graph: state.graph,
    tasks: toTaskViews(state),
    taskCounts: taskCounts(state),
  }
}

export function toRunSummary(
  state: RunState,
  opts: { startedAt: string; finishedAt?: string }
): RunSummary {
  return {
    id: state.runId,
    workflowId: state.workflowId,
    status: state.status,
    startedAt: opts.startedAt,
    finishedAt: opts.finishedAt,
    taskCounts: taskCounts(state),
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
