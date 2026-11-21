import type { RunDetail, Task as WorkflowTask } from "@workspace/shared"
import { upstreamEnvName } from "@workspace/shared"
import type { EnvVar } from "@/components/ai-elements/environment-variables"

function graphTask(run: RunDetail, taskId: string): WorkflowTask | undefined {
  return run.graph.tasks.find((t) => t.id === taskId)
}

/** Command line shown in Advanced (from the frozen graph). */
export function taskCommandLine(
  run: RunDetail,
  taskId: string
): string | undefined {
  const task = graphTask(run, taskId)
  if (!task) return undefined
  if (task.kind === "command") return task.run
  return `${task.cli} (agent)`
}

/** Flows-owned env for an attempt (DES-002), as relative path templates. */
export function taskEnvVars(
  run: RunDetail,
  taskId: string,
  attempt: number
): EnvVar[] {
  const runId = run.id
  const base: EnvVar[] = [
    { name: "RUN_ID", value: runId, badge: "run" },
    { name: "WF_DIR", value: "<workflow>", badge: "path" },
    { name: "WF_INPUT", value: "input", badge: "path" },
    { name: "WF_OUTPUT", value: "output", badge: "path" },
    { name: "RUN_INPUT", value: `runs/${runId}/input`, badge: "path" },
    {
      name: "TASK_IN",
      value: `runs/${runId}/tasks/${taskId}/input`,
      badge: "path",
    },
    {
      name: "TASK_OUT",
      value: `runs/${runId}/tasks/${taskId}/attempt-${attempt}/out`,
      badge: "path",
    },
    {
      name: "PREV_ATTEMPT",
      value:
        attempt > 1
          ? `runs/${runId}/tasks/${taskId}/attempt-${attempt - 1}`
          : "",
      badge: "path",
    },
  ]
  const upstream = run.graph.tasks.map((t) => ({
    name: upstreamEnvName(t.id),
    value: `runs/${runId}/tasks/${t.id}/latest/out`,
    badge: "upstream",
  }))
  return [...base, ...upstream]
}
