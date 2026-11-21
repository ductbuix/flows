import {
  isAgentTask,
  type Condition,
  type Need,
  type Task,
  type When,
  type Workflow,
} from "@workspace/shared"
import type { CliKind } from "./cli-adapters.ts"

function conditionNeedsAgent(cond: Condition): boolean {
  if ("agent" in cond) return true
  if ("all" in cond) return cond.all.some(conditionNeedsAgent)
  if ("any" in cond) return cond.any.some(conditionNeedsAgent)
  return false
}

function whenNeedsAgent(when: When | undefined): boolean {
  if (when === undefined || typeof when === "boolean") return false
  return conditionNeedsAgent(when)
}

function needNeedsAgent(need: Need): boolean {
  if (typeof need === "string") return false
  return need.when ? conditionNeedsAgent(need.when) : false
}

function taskNeedsAgent(task: Task): boolean {
  if (isAgentTask(task)) return true
  if (whenNeedsAgent(task.when)) return true
  if (task.repeat && conditionNeedsAgent(task.repeat.until)) return true
  return task.needs.some(needNeedsAgent)
}

/** True when the graph may launch an agent CLI (task or judge). */
export function workflowNeedsAgentCli(workflow: Workflow): boolean {
  return workflow.tasks.some(taskNeedsAgent)
}

/** Distinct CLIs the graph may invoke. */
export function workflowAgentClis(workflow: Workflow): CliKind[] {
  const found = new Set<CliKind>()

  function walkCondition(cond: Condition): void {
    if ("agent" in cond) {
      found.add(cond.agent.cli)
      return
    }
    if ("all" in cond) for (const c of cond.all) walkCondition(c)
    if ("any" in cond) for (const c of cond.any) walkCondition(c)
  }

  for (const task of workflow.tasks) {
    if (isAgentTask(task)) found.add(task.cli)
    if (task.when && typeof task.when !== "boolean") {
      walkCondition(task.when)
    }
    if (task.repeat) walkCondition(task.repeat.until)
    for (const need of task.needs) {
      if (typeof need !== "string" && need.when) walkCondition(need.when)
    }
  }
  return [...found]
}
