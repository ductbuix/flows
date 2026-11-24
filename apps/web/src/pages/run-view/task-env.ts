import type { RunDetail } from "@workspace/shared"
import { upstreamEnvName } from "@workspace/shared"
import type { EnvVar } from "@/components/data/EnvironmentVariables"

/** Command line shown in Terminal / Environment (from the frozen graph). */
export function taskCommandLine(
  run: RunDetail,
  taskId: string
): string | undefined {
  const node = run.graph.nodes.find((n) => n.id === taskId)
  if (!node) return undefined
  if (node.kind === "command") return node.run
  if (node.kind === "agent" || node.kind === "llm" || node.kind === "judge") {
    return `${node.cli} (${node.kind})`
  }
  return undefined
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
  const step = `runs/${runId}/nodes/${taskId}`
  const base: EnvVar[] = [
    { name: "RUN_ID", value: runId, badge: "run" },
    { name: "NODE_ID", value: taskId, badge: "run" },
    { name: "WF_DIR", value: "<workflow>", badge: "path" },
    { name: "WF_INPUT", value: "input", badge: "path" },
    { name: "WF_OUTPUT", value: "output", badge: "path" },
    { name: "RUN_INPUT", value: `runs/${runId}/input`, badge: "path" },
    {
      name: "NODE_IN",
      value: `${step}/pass-<n>/attempt-${attempt}/input`,
      badge: "path",
    },
    {
      name: "NODE_OUT",
      value: `${step}/pass-<n>/attempt-${attempt}/out`,
      badge: "path",
    },
    {
      name: "PREV_ATTEMPT",
      value: attempt > 1 ? `${step}/pass-<n>/attempt-${attempt - 1}` : "",
      badge: "path",
    },
  ]
  const upstream = run.graph.edges
    .filter((e) => e.to === taskId)
    .map((e) => ({
      name: upstreamEnvName(e.from),
      value: `runs/${runId}/nodes/${e.from}/pass-<n>/files`,
      badge: "upstream",
    }))
  return [...base, ...CACHE_ENV, ...upstream]
}
