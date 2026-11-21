import { useNavigate } from "react-router"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { type WorkflowTab, workflowPath } from "@/lib/paths"

type Props = {
  workflowId: string
  tab: WorkflowTab
}

/** Line tabs for workflow detail: Overview, Editor, Runs (DES-025). */
export function WorkflowDetailTabs({ workflowId, tab }: Props) {
  const navigate = useNavigate()

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (value === "overview" || value === "editor" || value === "runs") {
          void navigate(workflowPath(workflowId, value))
        }
      }}
      className="gap-0"
    >
      <TabsList variant="line" data-testid="workflow-detail-tabs">
        <TabsTrigger value="overview" data-testid="workflow-tab-overview">
          Overview
        </TabsTrigger>
        <TabsTrigger value="editor" data-testid="workflow-tab-editor">
          Editor
        </TabsTrigger>
        <TabsTrigger value="runs" data-testid="workflow-tab-runs">
          Runs
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
