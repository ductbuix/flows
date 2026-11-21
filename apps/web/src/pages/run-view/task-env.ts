import type { RunDetail, Task as WorkflowTask } from "@workspace/shared"
import { upstreamEnvName } from "@workspace/shared"
import type { EnvVar } from "@/components/ai-elements/environment-variables"

function graphTask(run: RunDetail, taskId: string): WorkflowTask | undefined {
  return run.graph.tasks.find((t) => t.id === taskId)
}

/** Command line shown in Terminal / Environment (from the frozen graph). */
export function taskCommandLine(
  run: RunDetail,
  taskId: string
): string | undefined {
  const task = graphTask(run, taskId)
  if (!task) return undefined
  if (task.kind === "command") return task.run
  return `${task.cli} (agent)`
}

const CACHE_ENV: EnvVar[] = [
  { name: "npm_config_cache", value: ".cache/npm", badge: "cache" },
  { name: "PNPM_STORE_DIR", value: ".cache/pnpm", badge: "cache" },
  { name: "YARN_CACHE_FOLDER", value: ".cache/yarn", badge: "cache" },
  { name: "XDG_CACHE_HOME", value: ".cache", badge: "cache" },
  { name: "PIP_CACHE_DIR", value: ".cache/pip", badge: "cache" },
]

/** Flows-owned env for an attempt (DES-002, DES-026), as path templates. */
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
  const attemptView = run.tasks
    .find((t) => t.id === taskId)
    ?.attempts.find((a) => a.attempt === attempt)
  if (attemptView?.portBase !== undefined) {
    const count = attemptView.portCount ?? 10
    base.push(
      { name: "PORT", value: String(attemptView.portBase), badge: "port" },
      {
        name: "FLOWS_PORT_BASE",
        value: String(attemptView.portBase),
        badge: "port",
      },
      { name: "FLOWS_PORT_COUNT", value: String(count), badge: "port" }
    )
  }
  const upstream = run.graph.tasks.map((t) => ({
    name: upstreamEnvName(t.id),
    value: `runs/${runId}/tasks/${t.id}/latest/out`,
    badge: "upstream",
  }))
  return [...base, ...CACHE_ENV, ...upstream]
}
