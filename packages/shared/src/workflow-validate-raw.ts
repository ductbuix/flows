import { judgePromptPath, taskPromptPath, type JudgeSlot } from "./task-ids.ts"

export type WorkflowIssue = {
  message: string
  path: (string | number)[]
}

export function leftoverInstructionsMessage(
  targetPath: string | undefined
): string {
  if (targetPath) {
    return (
      `remove the instructions key; move the file to ${targetPath} ` +
      `if needed`
    )
  }
  return "remove the instructions key; prompt paths are derived from the task id"
}

/**
 * Walk raw workflow JS (pre-zod) for leftover `instructions` keys
 * (DES-020).
 */
export function collectRawWorkflowIssues(raw: unknown): WorkflowIssue[] {
  const issues: WorkflowIssue[] = []
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return issues
  const tasks = (raw as { tasks?: unknown }).tasks
  if (!Array.isArray(tasks)) return issues

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task || typeof task !== "object" || Array.isArray(task)) continue
    const rec = task as Record<string, unknown>
    const id = typeof rec.id === "string" ? rec.id : undefined
    const pathBase: (string | number)[] = ["tasks", i]

    if ("instructions" in rec) {
      const target = id && rec.kind === "agent" ? taskPromptPath(id) : undefined
      issues.push({
        message: leftoverInstructionsMessage(target),
        path: [...pathBase, "instructions"],
      })
    }

    collectConditionIssues(
      rec.when,
      [...pathBase, "when"],
      id,
      { kind: "when" },
      issues
    )

    const repeat = rec.repeat
    if (repeat && typeof repeat === "object" && !Array.isArray(repeat)) {
      collectConditionIssues(
        (repeat as { until?: unknown }).until,
        [...pathBase, "repeat", "until"],
        id,
        { kind: "until" },
        issues
      )
    }

    const needs = rec.needs
    if (!Array.isArray(needs)) continue
    for (let j = 0; j < needs.length; j++) {
      const need = needs[j]
      if (!need || typeof need !== "object" || Array.isArray(need)) continue
      const needRec = need as Record<string, unknown>
      const needId = typeof needRec.task === "string" ? needRec.task : undefined
      collectConditionIssues(
        needRec.when,
        [...pathBase, "needs", j, "when"],
        id,
        needId ? { kind: "need", needTaskId: needId } : undefined,
        issues
      )
    }
  }
  return issues
}

function collectConditionIssues(
  condition: unknown,
  path: (string | number)[],
  taskId: string | undefined,
  slot: JudgeSlot | undefined,
  issues: WorkflowIssue[]
): void {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return
  }
  const rec = condition as Record<string, unknown>

  if ("agent" in rec) {
    const agent = rec.agent
    if (agent && typeof agent === "object" && !Array.isArray(agent)) {
      if ("instructions" in (agent as object)) {
        const target =
          taskId && slot ? judgePromptPath(taskId, slot) : undefined
        issues.push({
          message: leftoverInstructionsMessage(target),
          path: [...path, "agent", "instructions"],
        })
      }
    }
  }

  if ("all" in rec && Array.isArray(rec.all)) {
    for (let i = 0; i < rec.all.length; i++) {
      collectConditionIssues(
        rec.all[i],
        [...path, "all", i],
        taskId,
        slot,
        issues
      )
    }
  }
  if ("any" in rec && Array.isArray(rec.any)) {
    for (let i = 0; i < rec.any.length; i++) {
      collectConditionIssues(
        rec.any[i],
        [...path, "any", i],
        taskId,
        slot,
        issues
      )
    }
  }
}
