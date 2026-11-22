import { PageTitle } from "@/components/page"
import { type WorkflowTab } from "@/lib/paths"
import { WorkflowDetailTabs } from "./WorkflowDetailTabs"

type Props = {
  workflowId: string
  tab: WorkflowTab
  description: string
}

/** Workflow h1 with the Overview, Editor and Runs tabs under it. */
export function WorkflowHeading({ workflowId, tab, description }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={workflowId} description={description} />
      <WorkflowDetailTabs workflowId={workflowId} tab={tab} />
    </div>
  )
}
