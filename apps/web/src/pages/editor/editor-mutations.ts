import {
  addTask,
  applyWorkflowDiff,
  parseWorkflowYaml,
  renameTask,
  setTaskField,
  setTaskNeeds,
  setWorkflowField,
  type Need,
  type Task,
  type Workflow,
} from "@workspace/shared"

export function yamlAfterAddTask(yaml: string, workflow: Workflow): {
  yaml: string
  taskId: string
} {
  let n = 1
  const ids = new Set(workflow.tasks.map((t) => t.id))
  while (ids.has(`task-${n}`)) n++
  const task: Task = {
    id: `task-${n}`,
    kind: "command",
    run: "echo ok",
    needs: [],
  }
  return { yaml: addTask(yaml, task), taskId: task.id }
}

export function yamlAfterConnect(
  yaml: string,
  workflow: Workflow,
  source: string,
  target: string
): string | null {
  const task = workflow.tasks.find((t) => t.id === target)
  if (!task) return null
  const needs: Need[] = [...(task.needs ?? [])]
  if (needs.some((n) => (typeof n === "string" ? n : n.task) === source)) {
    return null
  }
  needs.push(source)
  return setTaskNeeds(yaml, target, needs)
}

export function yamlAfterGoal(yaml: string, goal: string): string {
  return setWorkflowField(yaml, "goal", goal)
}

export function yamlAfterTaskPatch(
  yaml: string,
  workflow: Workflow,
  taskId: string,
  patch: Partial<Task>
): string {
  const current = workflow.tasks.find((t) => t.id === taskId)
  if (!current) return yaml
  const next = { ...current, ...patch } as Task
  let nextYaml = yaml
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id") continue
    nextYaml = setTaskField(nextYaml, taskId, key, value)
  }
  const parsed = parseWorkflowYaml(nextYaml)
  if (!parsed.workflow) return nextYaml
  const tasks = parsed.workflow.tasks.map((t) =>
    t.id === taskId ? next : t
  )
  return applyWorkflowDiff(yaml, { ...parsed.workflow, tasks })
}

export function yamlAfterRename(
  yaml: string,
  fromId: string,
  toId: string
): string {
  return renameTask(yaml, fromId, toId)
}
