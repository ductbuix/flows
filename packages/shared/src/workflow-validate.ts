import { upstreamEnvName } from "./task-ids.ts"
import type { Condition, Task, Workflow } from "./workflow.ts"
import { isPublishTask, needTaskId } from "./workflow.ts"
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

/** Schema-level checks that need the parsed workflow (DES-020, DES-026). */
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
  pushProposeOrderIssues(workflow, issues)
  pushPublishProposeIssues(workflow, issues)
  return issues
}

/**
 * Two propose tasks on one connection must be ordered by `needs`
 * (DES-026 / BL-048).
 */
function pushProposeOrderIssues(
  workflow: Workflow,
  issues: WorkflowIssue[]
): void {
  const byId = new Map(workflow.tasks.map((t) => [t.id, t]))
  const indexById = new Map(workflow.tasks.map((t, i) => [t.id, i]))
  const byConnection = new Map<string, string[]>()

  for (const task of workflow.tasks) {
    for (const use of task.uses ?? []) {
      if (use.access !== "propose") continue
      const list = byConnection.get(use.connection) ?? []
      if (!list.includes(task.id)) list.push(task.id)
      byConnection.set(use.connection, list)
    }
  }

  for (const [connection, taskIds] of byConnection) {
    if (taskIds.length < 2) continue
    for (let i = 0; i < taskIds.length; i++) {
      for (let j = i + 1; j < taskIds.length; j++) {
        const a = taskIds[i]!
        const b = taskIds[j]!
        if (reachesViaNeeds(a, b, byId) || reachesViaNeeds(b, a, byId)) {
          continue
        }
        const pathTask = indexById.get(b) ?? 0
        const useIndex = (byId.get(b)?.uses ?? []).findIndex(
          (u) => u.connection === connection && u.access === "propose"
        )
        issues.push({
          message: `propose tasks ${a} and ${b} on ${connection} must be ordered by needs`,
          path: ["tasks", pathTask, "uses", Math.max(useIndex, 0)],
        })
      }
    }
  }
}

/** True when `to` is reachable by walking `needs` from `from`. */
function reachesViaNeeds(
  from: string,
  to: string,
  byId: Map<string, Task>
): boolean {
  const visiting = new Set<string>()
  function walk(id: string): boolean {
    if (id === to) return true
    if (visiting.has(id)) return false
    visiting.add(id)
    for (const need of byId.get(id)?.needs ?? []) {
      if (walk(needTaskId(need))) return true
    }
    visiting.delete(id)
    return false
  }
  return walk(from)
}

/**
 * A publish task needs an earlier propose task on the same connection
 * (DES-026 / BL-049). Read-only policy is checked with the connection
 * store in the engine.
 */
function pushPublishProposeIssues(
  workflow: Workflow,
  issues: WorkflowIssue[]
): void {
  const byId = new Map(workflow.tasks.map((t) => [t.id, t]))
  const indexById = new Map(workflow.tasks.map((t, i) => [t.id, i]))

  for (const task of workflow.tasks) {
    if (!isPublishTask(task)) continue
    const connection = task.connection
    const hasEarlierPropose = workflow.tasks.some((other) => {
      if (other.id === task.id) return false
      const proposes = (other.uses ?? []).some(
        (u) => u.connection === connection && u.access === "propose"
      )
      if (!proposes) return false
      // Walk publish → needs → … → propose (propose is an ancestor).
      return reachesViaNeeds(task.id, other.id, byId)
    })
    if (hasEarlierPropose) continue
    const pathTask = indexById.get(task.id) ?? 0
    issues.push({
      message: `publish task ${task.id} needs an earlier propose task on ${connection}`,
      path: ["tasks", pathTask, "connection"],
    })
  }
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
