import type { TaskUsesEntry, Workflow } from "@workspace/shared"
import type { Impact } from "@/components/data/ImpactBadge"

export type OverviewConnection = {
  connection: string
  access: TaskUsesEntry["access"] | "publish"
  taskIds: string[]
}

/** Unique connections from task uses and publish tasks (BL-046 / BL-051). */
export function overviewConnections(workflow: Workflow): OverviewConnection[] {
  const byId = new Map<string, OverviewConnection>()
  for (const task of workflow.tasks) {
    if (task.kind === "publish") {
      const existing = byId.get(task.connection)
      if (existing) {
        if (!existing.taskIds.includes(task.id)) {
          existing.taskIds.push(task.id)
        }
        existing.access = "publish"
        continue
      }
      byId.set(task.connection, {
        connection: task.connection,
        access: "publish",
        taskIds: [task.id],
      })
      continue
    }
    for (const use of task.uses ?? []) {
      const existing = byId.get(use.connection)
      if (existing) {
        if (!existing.taskIds.includes(task.id)) {
          existing.taskIds.push(task.id)
        }
        if (existing.access === "publish") continue
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

/** Impact badges: Read / Local from uses, Cloud from publish (BL-051). */
export function overviewImpacts(workflow: Workflow): Impact[] {
  const set = new Set<Impact>()
  for (const task of workflow.tasks) {
    if (task.kind === "publish") set.add("cloud")
    for (const use of task.uses ?? []) {
      if (use.access === "read") set.add("read")
      if (use.access === "propose") set.add("local")
    }
  }
  const order: Impact[] = ["read", "local", "cloud"]
  return order.filter((i) => set.has(i))
}

export function taskConnectionIds(task: Workflow["tasks"][number]): string[] {
  if (task.kind === "publish") return [task.connection]
  return (task.uses ?? []).map((u) => u.connection)
}
