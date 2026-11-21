import {
  addTask,
  applyWorkflowDiff,
  newTaskId,
  parseWorkflowYaml,
  removeTask,
  setTaskField,
  setTaskNeeds,
  setWorkflowField,
  switchTaskKind,
  taskWithKind,
  type Need,
  type Task,
  type Workflow,
  type WorkflowAgent,
  type WorkflowInputDecl,
  type WorkflowLimits,
} from "@workspace/shared"

export function yamlAfterAddTask(
  yaml: string,
  workflow: Workflow
): {
  yaml: string
  taskId: string
} {
  const task: Task = {
    id: newTaskId(workflow.tasks.map((t) => t.id)),
    kind: "command",
    run: "echo ok",
    needs: [],
  }
  return { yaml: addTask(yaml, task), taskId: task.id }
}

/** First connection with propose access anywhere in the workflow. */
export function firstProposeConnection(workflow: Workflow): string | undefined {
  for (const task of workflow.tasks) {
    for (const use of task.uses ?? []) {
      if (use.access === "propose") return use.connection
    }
  }
  return undefined
}

export function yamlAfterAddPublishTask(
  yaml: string,
  workflow: Workflow,
  connection: string
): {
  yaml: string
  taskId: string
} {
  const task: Task = {
    id: newTaskId(workflow.tasks.map((t) => t.id)),
    kind: "publish",
    connection,
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

export function yamlAfterRemoveTask(yaml: string, taskId: string): string {
  return removeTask(yaml, taskId)
}

export function yamlAfterGoal(yaml: string, goal: string): string {
  return setWorkflowField(yaml, "goal", goal)
}

export function yamlAfterInputs(
  yaml: string,
  inputs: WorkflowInputDecl[] | undefined
): string {
  return setWorkflowField(yaml, "inputs", inputs?.length ? inputs : undefined)
}

function limitsEmpty(limits: WorkflowLimits | undefined): boolean {
  if (!limits) return true
  return (
    limits.concurrency === undefined &&
    limits.agents === undefined &&
    limits.maxTasks === undefined &&
    limits.maxSpawnDepth === undefined &&
    limits.maxConcurrentRuns === undefined
  )
}

export function yamlAfterLimits(
  yaml: string,
  limits: WorkflowLimits | undefined
): string {
  return setWorkflowField(
    yaml,
    "limits",
    limitsEmpty(limits) ? undefined : limits
  )
}

export function yamlAfterAgent(
  yaml: string,
  agent: WorkflowAgent | undefined
): string {
  return setWorkflowField(yaml, "agent", agent)
}

export function yamlAfterTaskPatch(
  yaml: string,
  workflow: Workflow,
  taskId: string,
  patch: Partial<Task>
): { yaml: string; workflow: Workflow } {
  const current = workflow.tasks.find((t) => t.id === taskId)
  if (!current) return { yaml, workflow }

  if (
    patch.kind !== undefined &&
    (patch.kind === "command" ||
      patch.kind === "agent" ||
      patch.kind === "publish") &&
    patch.kind !== current.kind
  ) {
    const connection =
      patch.kind === "publish"
        ? "connection" in patch && typeof patch.connection === "string"
          ? patch.connection
          : (firstProposeConnection(workflow) ?? "connection")
        : undefined
    const next = taskWithKind({ ...current, connection }, patch.kind)
    const nextYaml = switchTaskKind(yaml, taskId, patch.kind, connection)
    const parsed = parseWorkflowYaml(nextYaml)
    return {
      yaml: nextYaml,
      workflow: parsed.workflow ?? {
        ...workflow,
        tasks: workflow.tasks.map((t) => (t.id === taskId ? next : t)),
      },
    }
  }

  const next = { ...current, ...patch } as Task
  let nextYaml = yaml
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id") continue
    nextYaml = setTaskField(nextYaml, taskId, key, value)
  }
  const parsed = parseWorkflowYaml(nextYaml)
  if (parsed.workflow) {
    const tasks = parsed.workflow.tasks.map((t) => (t.id === taskId ? next : t))
    return {
      yaml: applyWorkflowDiff(yaml, { ...parsed.workflow, tasks }),
      workflow: { ...parsed.workflow, tasks },
    }
  }
  // Keep an optimistic task so Inspector fields match the YAML (DES-018).
  return {
    yaml: nextYaml,
    workflow: {
      ...workflow,
      tasks: workflow.tasks.map((t) => (t.id === taskId ? next : t)),
    },
  }
}
