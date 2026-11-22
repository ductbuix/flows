import { createHash } from "node:crypto"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import {
  resolveModelEffort,
  type AgentJudge,
  type AgentSpec,
  type ResolvedModelEffort,
  type WorkflowAgent,
} from "@workspace/shared"
import { getCliAdapter } from "./cli-adapters.ts"
import { killProcessGroup } from "./pid.ts"
import { DEFAULT_ATTEMPT_TIMEOUT_SECONDS } from "./timeout.ts"

export { judgePrompt } from "./agent-prompt.ts"

export type JudgeResolveOpts = {
  /** Replaces the exit-code prompt (Judge node, DES-032). */
  prompt?: string
  parentTask?: AgentSpec
  workflowAgent?: WorkflowAgent
}

/** Headless Claude / Cursor CLI command for a condition judge. */
export function buildJudgeShellCommand(
  judge: AgentJudge,
  instructionsAbsPath: string,
  opts?: JudgeResolveOpts
): string {
  const resolved = resolveJudgeModelEffort(judge, opts)
  return getCliAdapter(judge.cli).buildJudgeCommand(
    judge,
    instructionsAbsPath,
    resolved,
    opts?.prompt
  )
}

/** The branch a Judge answer takes: its first word, yes or no (DES-032). */
export function judgeVerdict(text: string): "yes" | "no" | undefined {
  const word = /[a-z]+/i.exec(text)?.[0]?.toLowerCase()
  if (word === "yes" || word === "true") return "yes"
  if (word === "no" || word === "false") return "no"
  return undefined
}

export function resolveJudgeModelEffort(
  judge: AgentJudge,
  opts?: JudgeResolveOpts
): ResolvedModelEffort {
  return resolveModelEffort({
    judge,
    judgeCli: judge.cli,
    task: opts?.parentTask,
    workflowAgent: opts?.workflowAgent,
  })
}

export type RunJudgeOptions = {
  judge: AgentJudge
  /** Absolute path of the derived judge file (DES-020). */
  instructionsAbsPath: string
  workflowRoot: string
  attemptRoot: string
  /** Seconds; defaults to 900 (DES-019). */
  timeoutSeconds?: number
  parentTask?: AgentSpec
  workflowAgent?: WorkflowAgent
}

export type JudgeOutcome =
  { ok: true } | { ok: false; reason: "missing" | "fail" | "timeout" | "error" }

/**
 * Spawn the judge CLI with cwd at the attempt root. Exit 0 → pass.
 * Missing instructions, spawn failure, or timeout → fail with reason.
 */
export function runAgentJudgeDetailed(
  options: RunJudgeOptions
): Promise<JudgeOutcome> {
  const { judge, workflowRoot, attemptRoot, instructionsAbsPath } = options
  const timeoutSeconds =
    options.timeoutSeconds ?? DEFAULT_ATTEMPT_TIMEOUT_SECONDS
  const instructionsAbs = resolve(instructionsAbsPath)
  const root = resolve(workflowRoot)
  if (
    (!instructionsAbs.startsWith(root + "/") && instructionsAbs !== root) ||
    !existsSync(instructionsAbs)
  ) {
    return Promise.resolve({ ok: false, reason: "missing" })
  }
  if (!existsSync(attemptRoot)) {
    return Promise.resolve({ ok: false, reason: "missing" })
  }

  const cmd = buildJudgeShellCommand(judge, instructionsAbs, {
    parentTask: options.parentTask,
    workflowAgent: options.workflowAgent,
  })
  return new Promise((resolvePromise) => {
    let settled = false
    const finish = (outcome: JudgeOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise(outcome)
    }

    const child: ChildProcess = spawn("/bin/sh", ["-c", cmd], {
      cwd: attemptRoot,
      env: process.env,
      detached: true,
      stdio: "ignore",
    })
    const timer = setTimeout(() => {
      if (child.pid !== undefined) killProcessGroup(child.pid)
      finish({ ok: false, reason: "timeout" })
    }, timeoutSeconds * 1000)

    child.on("error", () => finish({ ok: false, reason: "error" }))
    child.on("close", (code) => {
      if (code === 0) finish({ ok: true })
      else finish({ ok: false, reason: "fail" })
    })
  })
}

/**
 * Key of one Judge node run: the CLI settings, the rule, the pass and a
 * hash of the input. The same key reuses a recorded verdict (DES-034).
 */
export function judgeNodeKey(parts: {
  judge: AgentJudge
  resolved: ResolvedModelEffort
  nodeId: string
  pass: number
  rule: string
  inputHash: string
}): string {
  return createHash("sha256")
    .update(
      [
        parts.judge.cli,
        parts.resolved.model ?? "",
        parts.resolved.effort ?? "",
        parts.nodeId,
        String(parts.pass),
        parts.rule,
        parts.inputHash,
      ].join("\0")
    )
    .digest("hex")
}
