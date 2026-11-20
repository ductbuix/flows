import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import { workflowSchema, type Workflow } from "@workspace/shared"

export function loadWorkflowFile(workflowRoot: string): Workflow {
  const raw = readFileSync(join(workflowRoot, "workflow.yaml"), "utf8")
  return workflowSchema.parse(parseYaml(raw))
}

/** Ensure needs refer to known tasks and the graph has no cycles. */
export function assertValidGraph(workflow: Workflow): void {
  const ids = new Set(workflow.tasks.map((t) => t.id))
  if (ids.size !== workflow.tasks.length) {
    throw new Error("workflow tasks must have unique ids")
  }
  for (const task of workflow.tasks) {
    for (const need of task.needs) {
      if (!ids.has(need)) {
        throw new Error(`task ${task.id} needs unknown task ${need}`)
      }
      if (need === task.id) {
        throw new Error(`task ${task.id} cannot need itself`)
      }
    }
  }
  detectCycle(workflow)
}

function detectCycle(workflow: Workflow): void {
  const byId = new Map(workflow.tasks.map((t) => [t.id, t]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function walk(id: string): void {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`workflow has a cycle involving ${id}`)
    }
    visiting.add(id)
    for (const need of byId.get(id)?.needs ?? []) {
      walk(need)
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const task of workflow.tasks) {
    walk(task.id)
  }
}
