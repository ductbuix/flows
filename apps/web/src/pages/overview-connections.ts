import type { TaskUsesEntry, Workflow } from "@workspace/shared"
import type { Impact } from "@/components/ImpactBadge"

export type OverviewConnection = {
  connection: string
  access: TaskUsesEntry["access"]
  taskIds: string[]
}

/** Unique connections from task uses, with task ids (BL-046). */
export function overviewConnections(workflow: Workflow): OverviewConnection[] {
  const byId = new Map<string, OverviewConnection>()
  for (const task of workflow.tasks) {
    for (const use of task.uses ?? []) {
      const existing = byId.get(use.connection)
      if (existing) {
        if (!existing.taskIds.includes(task.id)) {
          existing.taskIds.push(task.id)
        }
        if (use.access === "propose") existing.access = "propose"
        continue
      }
      byId.set(use.connection, {
        connection: use.connection,
        access: use.access,
        taskIds: [task.id],
      })
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.connection.localeCompare(b.connection)
  )
}

/** Impact badges implied by uses access (Read / Local). */
export function overviewImpacts(workflow: Workflow): Impact[] {
  const set = new Set<Impact>()
  for (const task of workflow.tasks) {
    for (const use of task.uses ?? []) {
      if (use.access === "read") set.add("read")
      if (use.access === "propose") set.add("local")
    }
  }
  const order: Impact[] = ["read", "local", "cloud"]
  return order.filter((i) => set.has(i))
}

export function taskConnectionIds(task: Workflow["tasks"][number]): string[] {
  return (task.uses ?? []).map((u) => u.connection)
}
