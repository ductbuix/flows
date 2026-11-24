import type { EventBus, UpdateBus } from "@workspace/core"
import {
  stepTaskStatus,
  type Engine,
  type StoredEvent,
} from "@workspace/engine"
import type { RunStep, RunSummary } from "@workspace/contracts"

const STEP_EVENT_TYPES = new Set([
  "step_started",
  "step_done",
  "step_failed",
  "step_skipped",
  "step_approved",
  "step_rejected",
  "step_retry_requested",
  "step_cancelled",
  "attempt_started",
  "attempt_launched",
  "attempt_finished",
  "attempt_interrupted",
  "approval_requested",
])

const FINISHED_EVENT_TYPES = new Set([
  "run_succeeded",
  "run_failed",
  "run_cancelled",
])

/** Publishes FCP run/update kinds besides run_changed (BL-176). */
export function publishRunFcpUpdates(
  engine: Engine,
  bus: UpdateBus,
  events: EventBus,
  stored: StoredEvent,
  summary: RunSummary | null
): void {
  const { event } = stored
  const runId = event.runId

  if (STEP_EVENT_TYPES.has(event.type)) {
    const nodeId =
      "nodeId" in event && typeof event.nodeId === "string"
        ? event.nodeId
        : "taskId" in event && typeof event.taskId === "string"
          ? event.taskId
          : undefined
    if (nodeId) {
      const step = stepSnapshot(engine, runId, nodeId)
      if (step) {
        bus.publish("run/update", { kind: "step_state", runId, step })
      }
    }
  }

  if (FINISHED_EVENT_TYPES.has(event.type) && summary) {
    const status = summary.status
    if (
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      bus.publish("run/update", {
        kind: "run_finished",
        runId,
        status,
        summary,
      })
      events.emit("run.finished", {
        runId,
        workflowId: summary.workflowId,
        status,
        ...(summary.workItemId !== undefined
          ? { cardId: summary.workItemId }
          : {}),
      })
    }
  }
}

function stepSnapshot(
  engine: Engine,
  runId: string,
  nodeId: string
): RunStep | null {
  const state = engine.fold(runId)
  if (!state || state.deleted) return null
  const node = state.graph.nodes.find((n) => n.id === nodeId)
  const step = state.steps.steps[nodeId]?.at(-1)
  if (!node || !step) return null
  return {
    nodeId,
    kind: node.kind,
    pass: step.pass,
    attempts: step.attempts,
    status: stepTaskStatus(step.status),
    ...(step.branch ? { branch: step.branch } : {}),
    ...(step.failReason ? { failReason: step.failReason } : {}),
    ...(step.question !== undefined ? { question: step.question } : {}),
    ...(step.decision ? { decision: step.decision } : {}),
    ...(step.answer ? { answer: step.answer } : {}),
    ...(step.reused ? { reused: true as const } : {}),
    ...(step.current?.startedAt ? { startedAt: step.current.startedAt } : {}),
    ...(step.current?.endedAt ? { endedAt: step.current.endedAt } : {}),
  }
}
