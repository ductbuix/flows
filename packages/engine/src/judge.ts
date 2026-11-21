import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import type { AgentJudge } from "@workspace/shared"
import { getCliAdapter } from "./cli-adapters.ts"
import { killProcessGroup } from "./pid.ts"
import { DEFAULT_ATTEMPT_TIMEOUT_SECONDS } from "./timeout.ts"

export { judgePrompt } from "./agent-prompt.ts"

/** Headless Claude / Cursor CLI command for a condition judge. */
export function buildJudgeShellCommand(
  judge: AgentJudge,
  instructionsAbsPath: string
): string {
  return getCliAdapter(judge.cli).buildJudgeCommand(judge, instructionsAbsPath)
}

export type RunJudgeOptions = {
  judge: AgentJudge
  /** Absolute path of the derived judge file (DES-020). */
  instructionsAbsPath: string
  workflowRoot: string
  attemptRoot: string
  /** Seconds; defaults to 900 (DES-019). */
  timeoutSeconds?: number
}

/**
 * Spawn the judge CLI with cwd at the attempt root. Exit 0 → pass.
 * Missing instructions, spawn failure, or timeout → fail.
 */
export function runAgentJudge(options: RunJudgeOptions): Promise<boolean> {
  const { judge, workflowRoot, attemptRoot, instructionsAbsPath } = options
  const timeoutSeconds =
    options.timeoutSeconds ?? DEFAULT_ATTEMPT_TIMEOUT_SECONDS
  const instructionsAbs = resolve(instructionsAbsPath)
  const root = resolve(workflowRoot)
  if (
    (!instructionsAbs.startsWith(root + "/") && instructionsAbs !== root) ||
    !existsSync(instructionsAbs)
  ) {
    return Promise.resolve(false)
  }
  if (!existsSync(attemptRoot)) return Promise.resolve(false)

  const cmd = buildJudgeShellCommand(judge, instructionsAbs)
  return new Promise((resolvePromise) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise(ok)
    }

    const child: ChildProcess = spawn("/bin/sh", ["-c", cmd], {
      cwd: attemptRoot,
      env: process.env,
      detached: true,
      stdio: "ignore",
    })
    const timer = setTimeout(() => {
      if (child.pid !== undefined) killProcessGroup(child.pid)
      finish(false)
    }, timeoutSeconds * 1000)

    child.on("error", () => finish(false))
    child.on("close", (code) => finish(code === 0))
  })
}

/** Cache key so a run tick does not re-spawn the same judge. */
export function judgeCacheKey(
  judge: AgentJudge,
  instructionsAbsPath: string,
  workflowRoot: string,
  attemptRoot: string
): string {
  return `${judge.cli}\0${instructionsAbsPath}\0${workflowRoot}\0${attemptRoot}`
}
