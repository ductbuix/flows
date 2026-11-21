import { stringify } from "yaml"
import type { Workflow } from "./workflow.ts"
import {
  addTask,
  removeTask,
  setWorkflowField,
  upsertTask,
} from "./workflow-yaml-edit.ts"
import { parseWorkflowYaml } from "./workflow-yaml.ts"

export function applyWorkflowDiff(text: string, next: Workflow): string {
  const current = parseWorkflowYaml(text)
  let out = text
  if (!current.workflow) {
    // Last resort when the source cannot be patched in place.
    return stringify(next)
  }
  const prev = current.workflow
  if (prev.goal !== next.goal) out = setWorkflowField(out, "goal", next.goal)
  if (JSON.stringify(prev.limits) !== JSON.stringify(next.limits)) {
    out = setWorkflowField(out, "limits", next.limits)
  }
  if (JSON.stringify(prev.inputs) !== JSON.stringify(next.inputs)) {
    out = setWorkflowField(
      out,
      "inputs",
      next.inputs === undefined || next.inputs.length === 0
        ? undefined
        : next.inputs
    )
  }
  if (prev.id !== next.id) out = setWorkflowField(out, "id", next.id)

  const prevIds = new Set(prev.tasks.map((t) => t.id))
  const nextIds = new Set(next.tasks.map((t) => t.id))
  for (const id of prevIds) {
    if (!nextIds.has(id)) out = removeTask(out, id)
  }
  for (const task of next.tasks) {
    if (!prevIds.has(task.id)) out = addTask(out, task)
    else {
      const old = prev.tasks.find((t) => t.id === task.id)!
      if (JSON.stringify(old) !== JSON.stringify(task)) {
        out = upsertTask(out, task)
      }
    }
  }
  return out
}
