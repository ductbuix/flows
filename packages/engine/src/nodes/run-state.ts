import {
  nodeWorkflowSchema,
  type EngineEvent,
  type NodeWorkflow,
  type TaskStatus,
  type Workflow,
} from "@workspace/shared"
import type { RunState, TaskState } from "../fold.ts"
import { foldSteps, type StepState, type StepStatus } from "./fold-steps.ts"

/** True for a node graph (DES-034); a task graph has `tasks`. */
export function isNodeGraph(graph: unknown): boolean {
  return typeof graph === "object" && graph !== null && "nodes" in graph
}

/**
 * Task-shaped view of a node graph, so run lists, summaries and the run
 * view read node runs through the code that exists today (BL-093). One
 * task per node; `needs` follow the edges.
 */
export function taskGraphOfNodes(graph: NodeWorkflow): Workflow {
  const tasks = graph.nodes.map((n) => ({
    id: n.id,
    ...(n.name ? { name: n.name } : {}),
    kind: "command" as const,
    run: n.kind,
    needs: [
      ...new Set(graph.edges.filter((e) => e.to === n.id).map((e) => e.from)),
    ],
  }))
  return {
    id: graph.id,
    ...(graph.limits
      ? {
          limits: {
            ...(graph.limits.concurrency !== undefined
              ? { concurrency: graph.limits.concurrency }
              : {}),
            ...(graph.limits.agents !== undefined
              ? { agents: graph.limits.agents }
              : {}),
            ...(graph.limits.maxConcurrentRuns !== undefined
              ? { maxConcurrentRuns: graph.limits.maxConcurrentRuns }
              : {}),
          },
        }
      : {}),
    tasks,
  } as Workflow
}

const STATUS: Record<StepStatus, TaskStatus> = {
  pending: "pending",
  running: "running",
  waiting: "awaiting_approval",
  done: "succeeded",
  failed: "failed",
  skipped: "skipped",
  cancelled: "cancelled",
}

/** Run-view status of a step (BL-087). */
export function stepTaskStatus(status: StepStatus): TaskStatus {
  return STATUS[status]
}

function taskOf(nodeId: string, step: StepState | undefined): TaskState {
  if (!step) return { id: nodeId, status: "pending", attempts: [] }
  const c = step.current
  return {
    id: nodeId,
    status: STATUS[step.status],
    attempts: c
      ? [
          {
            attempt: c.attempt,
            pid: c.pid,
            exitCode: c.exitCode,
            interrupted: c.interrupted,
            startedAt: c.startedAt,
            timeout: c.timeout,
            reason: c.reason,
          },
        ]
      : [],
  }
}

/** Fills `steps`, `nodeGraph` and the per-node tasks from the step fold. */
export function applyNodeSteps(
  state: RunState,
  events: readonly EngineEvent[]
): void {
  const started = events.find((e) => e.type === "run_started")
  if (!started || started.type !== "run_started") return
  if (!isNodeGraph(started.graph)) return
  const graph = nodeWorkflowSchema.parse(started.graph) as NodeWorkflow
  const steps = foldSteps(events)
  state.nodeGraph = graph
  state.steps = steps
  for (const n of graph.nodes) {
    const list = steps.steps[n.id]
    state.tasks[n.id] = taskOf(n.id, list?.[list.length - 1])
  }
}
