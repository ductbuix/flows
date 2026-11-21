import type { RunDetail, TaskView } from "@workspace/shared"
import { Plan, type PlanStep } from "@/components/ai-elements/plan"

type Props = {
  run: RunDetail
}

function stepStatus(task: TaskView): PlanStep["status"] {
  switch (task.status) {
    case "running":
    case "awaiting_approval":
      return "running"
    case "pending":
      return "pending"
    default:
      return "done"
  }
}

/** Run-level Plan of task steps, shown beside the task Table (DES-025). */
export function RunPlan({ run }: Props) {
  const labels = new Map(
    run.graph.tasks.map((t) => [t.id, t.name ?? t.id] as const)
  )
  const steps: PlanStep[] = run.tasks.map((task) => ({
    title: labels.get(task.id) ?? task.id,
    status: stepStatus(task),
  }))

  if (steps.length === 0) return null

  return <Plan title="Plan" steps={steps} data-testid="run-plan" />
}
