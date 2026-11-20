import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  isAgentTask,
  type AgentTask,
  type EngineEvent,
  type Workflow,
} from "@workspace/shared"
import { isOpenAttempt, type RunState } from "./fold.ts"
import { retryBackoffMs } from "./loops.ts"
import { attemptDir, taskDir } from "./paths.ts"
import {
  processSpawnDir,
  type SpawnRejection,
} from "./spawn-validate.ts"

export { processSpawnDir, type SpawnRejection } from "./spawn-validate.ts"

function now(): string {
  return new Date().toISOString()
}

export type SpawnHost = {
  runId: string
  runRoot: string
  state: () => RunState
  append: (event: EngineEvent) => void
  scheduleRetry: (taskId: string, backoffMs: number) => void
  globalLimits?: Workflow["limits"]
}

/** Write rejection feedback for the agent's next input (DES-005). */
export function writeSpawnRejections(
  runRoot: string,
  taskId: string,
  rejections: SpawnRejection[]
): void {
  const inputDir = join(taskDir(runRoot, taskId), "input")
  mkdirSync(inputDir, { recursive: true })
  const lines = [
    "# Spawn rejections",
    "",
    "The engine rejected these spawn specs. Fix and try again.",
    "",
    ...rejections.map((r) => `- **${r.file}**: ${r.reason}`),
    "",
  ]
  writeFileSync(join(inputDir, "spawn-rejections.md"), lines.join("\n"))
}

function persistGraph(runRoot: string, graph: Workflow): void {
  writeFileSync(join(runRoot, "graph.json"), JSON.stringify(graph, null, 2))
}

/**
 * After a spawn-capable agent attempt exits 0: accept spawn specs, feed
 * rejections back, succeed or retry (DES-005).
 */
export function resolveSpawn(host: SpawnHost): void {
  const state = host.state()
  if (state.status !== "running" || state.cancelRequested) return

  for (const task of state.graph.tasks) {
    if (!isAgentTask(task) || task.spawn !== true) continue
    const live = state.tasks[task.id]
    if (!live || live.status !== "running") continue
    if (live.attempts.some(isOpenAttempt)) continue
    if (live.attempts.length === 0) continue

    const last = live.attempts[live.attempts.length - 1]!
    if (last.exitCode !== 0 || last.interrupted) continue

    settleSpawnAgent(host, task, live.attempts.length)
  }
}

function settleSpawnAgent(
  host: SpawnHost,
  task: AgentTask,
  attemptCount: number
): void {
  const attemptRoot = attemptDir(host.runRoot, task.id, attemptCount)
  const { accepted, rejections } = processSpawnDir(
    task,
    attemptRoot,
    host.state().graph,
    host.globalLimits
  )

  if (accepted.length > 0) {
    host.append({
      type: "tasks_spawned",
      runId: host.runId,
      parentTaskId: task.id,
      tasks: accepted,
      at: now(),
    })
    persistGraph(host.runRoot, host.state().graph)
    for (const spawned of accepted) {
      mkdirSync(join(taskDir(host.runRoot, spawned.id), "input"), {
        recursive: true,
      })
    }
  }

  if (rejections.length > 0) {
    writeSpawnRejections(host.runRoot, task.id, rejections)
    const retryMax = task.retry?.max
    if (retryMax !== undefined && attemptCount < retryMax) {
      host.scheduleRetry(task.id, retryBackoffMs())
      return
    }
  }

  host.append({
    type: "task_succeeded",
    runId: host.runId,
    taskId: task.id,
    at: now(),
  })
}
