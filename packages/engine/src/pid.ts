import { readFileSync } from "node:fs"
import { join } from "node:path"
import { attemptDir } from "./paths.ts"

/** True if the process exists (signal 0). */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function exitCodePath(
  runRoot: string,
  taskId: string,
  attempt: number
): string {
  return join(attemptDir(runRoot, taskId, attempt), "exit.code")
}

/** Read exit.code written by the launch wrapper; null if missing or invalid. */
export function readExitCode(
  runRoot: string,
  taskId: string,
  attempt: number
): number | null {
  try {
    const raw = readFileSync(
      exitCodePath(runRoot, taskId, attempt),
      "utf8"
    ).trim()
    if (!/^-?\d+$/.test(raw)) return null
    return Number(raw)
  } catch {
    return null
  }
}

/** Poll until pid is gone, then resolve. */
export function waitForPid(pid: number, intervalMs = 50): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!isPidAlive(pid)) {
        resolve()
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}
