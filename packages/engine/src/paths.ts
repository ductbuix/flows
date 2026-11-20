import { homedir } from "node:os"
import { join } from "node:path"

/** Resolve the app home: FLOWAPP_HOME, else ~/.flowapp (DES-002). */
export function resolveAppHome(override?: string): string {
  if (override) return override
  if (process.env.FLOWAPP_HOME) return process.env.FLOWAPP_HOME
  return join(homedir(), ".flowapp")
}

export function appDbPath(home: string): string {
  return join(home, "app.db")
}

export function workflowDir(home: string, workflowId: string): string {
  return join(home, "workflows", workflowId)
}

export function runDir(workflowRoot: string, runId: string): string {
  return join(workflowRoot, "runs", runId)
}

export function taskDir(runRoot: string, taskId: string): string {
  return join(runRoot, "tasks", taskId)
}

export function attemptDir(
  runRoot: string,
  taskId: string,
  attempt: number
): string {
  return join(taskDir(runRoot, taskId), `attempt-${attempt}`)
}
