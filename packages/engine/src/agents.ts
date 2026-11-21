import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import {
  resolveModelEffort,
  type AgentTask,
  type WorkflowAgent,
} from "@workspace/shared"
import { getCliAdapter } from "./cli-adapters.ts"

import type { AgentLaunchPaths } from "./agent-prompt.ts"

export {
  agentPrompt,
  shellSingleQuote,
  type AgentLaunchPaths,
} from "./agent-prompt.ts"

/**
 * Headless Claude Code / Cursor CLI command for an agent attempt.
 * cwd must be the attempt dir when launched (DES-005). Allowed-dir /
 * workspace flags keep the CLI inside the workflow (DES-006).
 */
export function buildAgentShellCommand(
  task: AgentTask,
  instructionsAbsPath: string,
  paths: AgentLaunchPaths,
  workflowAgent?: WorkflowAgent
): string {
  const resolved = resolveModelEffort({ task, workflowAgent })
  return getCliAdapter(task.cli).buildAgentCommand(
    task,
    instructionsAbsPath,
    paths,
    resolved
  )
}

/**
 * Copy listed memory/*.md into the task's input/memory/ (DES-005).
 * Paths are relative to the workflow root.
 */
export function copyTaskMemories(
  task: AgentTask,
  workflowRoot: string,
  taskInputDir: string
): void {
  const memoryDir = join(taskInputDir, "memory")
  rmSync(memoryDir, { recursive: true, force: true })
  const listed = task.memory ?? []
  if (listed.length === 0) return

  mkdirSync(memoryDir, { recursive: true })
  const root = resolve(workflowRoot)
  for (const rel of listed) {
    const src = resolve(workflowRoot, rel)
    if (!src.startsWith(root + "/") && src !== root) {
      throw new Error(`memory path escapes workflow dir: ${rel}`)
    }
    if (!existsSync(src)) {
      throw new Error(`memory file missing: ${rel}`)
    }
    const dest = join(memoryDir, rel.split("/").pop()!)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(src, dest)
  }
}

/** Ensure attempt out/ (and out/spawn when allowed) exist. */
export function prepareAgentAttemptOut(
  attemptRoot: string,
  canSpawn: boolean
): void {
  mkdirSync(join(attemptRoot, "out"), { recursive: true })
  if (canSpawn) {
    mkdirSync(join(attemptRoot, "out", "spawn"), { recursive: true })
  }
}
