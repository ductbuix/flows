import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import type { AgentTask } from "@workspace/shared"

/** Shell-safe single-quoted string. */
export function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

/** Prompt that points the CLI at the instructions file (DES-005). */
export function agentPrompt(
  instructionsAbsPath: string,
  canSpawn: boolean
): string {
  const spawn = canSpawn
    ? " To spawn tasks, write one YAML task spec per file under out/spawn/."
    : ""
  return (
    `Read the file at ${instructionsAbsPath} and follow those instructions. ` +
    `Your working directory is this attempt. Write outputs under out/. ` +
    `Memories are under input/memory/. Upstream outputs are in the UPSTREAM_* env paths.` +
    spawn
  )
}

/**
 * Headless Claude Code / Cursor CLI command for an agent attempt.
 * cwd must be the attempt dir when launched (DES-005).
 */
export function buildAgentShellCommand(
  task: AgentTask,
  instructionsAbsPath: string
): string {
  const prompt = shellSingleQuote(
    agentPrompt(instructionsAbsPath, task.spawn === true)
  )
  if (task.cli === "claude") {
    return `claude --print --permission-mode dontAsk -- ${prompt}`
  }
  return `agent -p --force --trust -- ${prompt}`
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
