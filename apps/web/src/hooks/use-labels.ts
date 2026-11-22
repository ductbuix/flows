import { useCallback } from "react"
import type { RunSummary } from "@workspace/shared"
import { useWorkItemTitles } from "@/hooks/use-work-item-titles"
import { runLabel, workflowLabel } from "@/lib/labels"
import { useWorkflows } from "@/lib/workflows-context"

/** Readable labels for runs and their workflows (BL-059). */
export function useLabels() {
  const { workflows } = useWorkflows()
  const titles = useWorkItemTitles()

  const workflowLabelFor = useCallback(
    (workflowId: string) =>
      workflowLabel(
        workflows?.find((wf) => wf.id === workflowId) ?? { id: workflowId }
      ),
    [workflows]
  )
  const runLabelFor = useCallback(
    (run: Pick<RunSummary, "workItemId">) =>
      runLabel({
        workItemTitle: run.workItemId ? titles.get(run.workItemId) : undefined,
      }),
    [titles]
  )
  return { workflowLabelFor, runLabelFor }
}
