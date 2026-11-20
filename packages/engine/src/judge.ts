import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import type { AgentJudge } from "@workspace/shared"
import { shellSingleQuote } from "./agents.ts"

/** Prompt: inspect the attempt and exit 0/non-zero (DES-004). */
export function judgePrompt(instructionsAbsPath: string): string {
  return (
    `Read the file at ${instructionsAbsPath} and follow those instructions ` +
    `to judge this attempt. Your working directory is this attempt. ` +
    `Inspect out/ and any paths mentioned. Exit with code 0 if the ` +
    `condition passes, or a non-zero code if it fails.`
  )
}

/** Headless Claude / Cursor CLI command for a condition judge. */
export function buildJudgeShellCommand(
  judge: AgentJudge,
  instructionsAbsPath: string
): string {
  const prompt = shellSingleQuote(judgePrompt(instructionsAbsPath))
  if (judge.cli === "claude") {
    return `claude --print --permission-mode dontAsk -- ${prompt}`
  }
  return `agent -p --force --trust -- ${prompt}`
}

export type RunJudgeOptions = {
  judge: AgentJudge
  workflowRoot: string
  attemptRoot: string
}

/**
 * Spawn the judge CLI with cwd at the attempt root. Exit 0 → pass.
 * Missing instructions or spawn failure → fail.
 */
export function runAgentJudge(options: RunJudgeOptions): Promise<boolean> {
  const { judge, workflowRoot, attemptRoot } = options
  const instructionsAbs = resolve(workflowRoot, judge.instructions)
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
    const child = spawn("/bin/sh", ["-c", cmd], {
      cwd: attemptRoot,
      env: process.env,
      stdio: "ignore",
    })
    child.on("error", () => resolvePromise(false))
    child.on("close", (code) => resolvePromise(code === 0))
  })
}

/** Cache key so a run tick does not re-spawn the same judge. */
export function judgeCacheKey(
  judge: AgentJudge,
  workflowRoot: string,
  attemptRoot: string
): string {
  return `${judge.cli}\0${judge.instructions}\0${workflowRoot}\0${attemptRoot}`
}
