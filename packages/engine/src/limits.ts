import {
  isAgentTask,
  type Task,
  type Workflow,
  type WorkflowLimits,
} from "@workspace/shared"
import { effectiveLimit } from "./config.ts"
import type { RunState } from "./fold.ts"

export type LimitCaps = {
  concurrency?: number
  agents?: number
}

/** Caps from global config and the run's workflow limits (DES-003). */
export function limitCaps(
  globalLimits: WorkflowLimits | undefined,
  graph: Workflow
): LimitCaps {
  return {
    concurrency: effectiveLimit(globalLimits, graph.limits, "concurrency"),
    agents: effectiveLimit(globalLimits, graph.limits, "agents"),
  }
}

export function countRunning(state: RunState): number {
  return Object.values(state.tasks).filter((t) => t.status === "running").length
}

export function countRunningAgents(state: RunState, graph: Workflow): number {
  const byId = new Map(graph.tasks.map((t) => [t.id, t]))
  return Object.values(state.tasks).filter((t) => {
    if (t.status !== "running") return false
    const spec = byId.get(t.id)
    return spec ? isAgentTask(spec) : false
  }).length
}

/**
 * Whether launching `task` would fit under concurrency and agents caps.
 * Awaiting_approval holds no slot (DES-003).
 */
export function fitsLimits(
  task: Task,
  state: RunState,
  graph: Workflow,
  caps: LimitCaps
): boolean {
  const running = countRunning(state)
  if (caps.concurrency !== undefined && running >= caps.concurrency) {
    return false
  }
  if (isAgentTask(task) && caps.agents !== undefined) {
    if (countRunningAgents(state, graph) >= caps.agents) return false
  }
  return true
}
