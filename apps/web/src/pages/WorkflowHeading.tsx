import { PageTitle } from "@/components/page"
import { type WorkflowTab } from "@/lib/paths"
import { useWorkflowLabel } from "@/lib/workflows-context"
import { WorkflowDetailTabs } from "./WorkflowDetailTabs"

type Props = {
  workflowId: string
  tab: WorkflowTab
  description: string
  /** Unsaved name from the editor; wins over the loaded summary. */
  name?: string
}

/** Workflow h1 with the Overview, Editor and Runs tabs under it. */
export function WorkflowHeading({ workflowId, tab, description, name }: Props) {
  const label = useWorkflowLabel(workflowId, name)
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={label} description={description} />
      <WorkflowDetailTabs workflowId={workflowId} tab={tab} />
    </div>
  )
}
