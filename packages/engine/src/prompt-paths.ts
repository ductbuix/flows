import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import {
  isAgentTask,
  judgePromptPath,
  taskPromptPath,
  type JudgeSlot,
  type Task,
} from "@workspace/shared"

/**
 * Absolute directory that holds prompt.md / when.md / until.md /
 * need-*.md for a task (DES-020).
 */
export function taskPromptDirAbs(
  task: Task,
  workflowRoot: string,
  runRoot: string
): string {
  if (task.promptDir) return resolve(runRoot, task.promptDir)
  return resolve(workflowRoot, "tasks", task.id)
}

/** Absolute path of an agent task's prompt.md. */
export function taskPromptAbs(
  task: Task,
  workflowRoot: string,
  runRoot: string
): string {
  if (task.promptDir) {
    return join(resolve(runRoot, task.promptDir), "prompt.md")
  }
  return resolve(workflowRoot, taskPromptPath(task.id))
}

/** Absolute path of a judge file for a slot on a task. */
export function judgePromptAbs(
  task: Task,
  slot: JudgeSlot,
  workflowRoot: string,
  runRoot: string
): string {
  if (task.promptDir) {
    const file =
      slot.kind === "when"
        ? "when.md"
        : slot.kind === "until"
          ? "until.md"
          : `need-${slot.needTaskId}.md`
    return join(resolve(runRoot, task.promptDir), file)
  }
  return resolve(workflowRoot, judgePromptPath(task.id, slot))
}

/** True when an authored (non-spawned) agent task is missing prompt.md. */
export function authoredPromptMissing(
  task: Task,
  workflowRoot: string
): boolean {
  if (!isAgentTask(task) || task.promptDir) return false
  return !existsSync(resolve(workflowRoot, taskPromptPath(task.id)))
}
