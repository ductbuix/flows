import { upstreamEnvName } from "./task-ids.ts"
import type { Condition, Task, Workflow } from "./workflow.ts"
import { needTaskId } from "./workflow.ts"
import {
  leftoverInstructionsMessage,
  collectRawWorkflowIssues,
  type WorkflowIssue,
} from "./workflow-validate-raw.ts"

export type { WorkflowIssue }
export { collectRawWorkflowIssues }

/** Count agent judge leaves in a condition tree. */
export function countAgentJudges(condition: Condition): number {
  if ("agent" in condition) return 1
  if ("all" in condition) {
    return condition.all.reduce((n, c) => n + countAgentJudges(c), 0)
  }
  if ("any" in condition) {
    return condition.any.reduce((n, c) => n + countAgentJudges(c), 0)
  }
  return 0
}

/** Schema-level checks that need the parsed workflow (DES-020). */
export function collectWorkflowIssues(workflow: Workflow): WorkflowIssue[] {
  const issues: WorkflowIssue[] = []
  const envNames = new Map<string, string>()

  for (let i = 0; i < workflow.tasks.length; i++) {
    const task = workflow.tasks[i]!
    const env = upstreamEnvName(task.id)
    const prior = envNames.get(env)
    if (prior !== undefined) {
      issues.push({
        message: `tasks ${prior} and ${task.id} map to the same env name ${env}`,
        path: ["tasks", i, "id"],
      })
    } else {
      envNames.set(env, task.id)
    }

    pushJudgeSlotIssues(task, i, issues)
  }
  return issues
}

function pushJudgeSlotIssues(
  task: Task,
  taskIndex: number,
  issues: WorkflowIssue[]
): void {
  checkSlot(task.when, ["tasks", taskIndex, "when"], "when", issues)
  checkSlot(
    task.repeat?.until,
    ["tasks", taskIndex, "repeat", "until"],
    "until",
    issues
  )
  for (let j = 0; j < task.needs.length; j++) {
    const need = task.needs[j]!
    if (typeof need === "string" || !need.when) continue
    checkSlot(
      need.when,
      ["tasks", taskIndex, "needs", j, "when"],
      `need-${needTaskId(need)}`,
      issues
    )
  }
}

function checkSlot(
  when: boolean | Condition | undefined,
  path: (string | number)[],
  slotLabel: string,
  issues: WorkflowIssue[]
): void {
  if (when === undefined || typeof when === "boolean") return
  const count = countAgentJudges(when)
  if (count > 1) {
    issues.push({
      message: `at most one agent judge per ${slotLabel} slot (found ${count})`,
      path,
    })
  }
}

/** Message when a spawn spec still has an `id` key. */
export function spawnIdRejectedMessage(stem: string): string {
  return (
    `remove the id key; spawn specs are identified by the file stem ` +
    `(${stem})`
  )
}

/** Message when a spawn spec still has an `instructions` key. */
export function spawnInstructionsRejectedMessage(
  stem: string,
  kind: unknown
): string {
  const target = kind === "agent" ? `${stem}/prompt.md` : undefined
  return leftoverInstructionsMessage(target ? `out/spawn/${target}` : undefined)
}
