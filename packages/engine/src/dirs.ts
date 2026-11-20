import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { Workflow } from "@workspace/shared"
import { attemptDir, runDir, taskDir } from "./paths.ts"

/** Create run dirs and freeze the graph (DES-002). */
export function prepareRunDirs(
  workflowRoot: string,
  runId: string,
  graph: Workflow
): string {
  const runRoot = runDir(workflowRoot, runId)
  mkdirSync(runRoot, { recursive: true })
  writeFileSync(join(runRoot, "graph.json"), JSON.stringify(graph, null, 2))

  for (const task of graph.tasks) {
    mkdirSync(join(taskDir(runRoot, task.id), "input"), { recursive: true })
  }

  mkdirSync(join(workflowRoot, "input"), { recursive: true })
  mkdirSync(join(workflowRoot, "output"), { recursive: true })

  return runRoot
}

/** Create attempt-<n>/out and point latest at it. */
export function prepareAttemptDirs(
  runRoot: string,
  taskId: string,
  attempt: number
): string {
  const root = attemptDir(runRoot, taskId, attempt)
  mkdirSync(join(root, "out"), { recursive: true })

  const latest = join(taskDir(runRoot, taskId), "latest")
  rmSync(latest, { force: true, recursive: true })
  symlinkSync(`attempt-${attempt}`, latest)

  return root
}
