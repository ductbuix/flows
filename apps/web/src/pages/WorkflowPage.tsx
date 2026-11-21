import { useSearchParams } from "react-router"
import { parseWorkflowTab } from "@/lib/paths"
import { WorkflowEditorPage } from "@/pages/editor/WorkflowEditorPage"
import { WorkflowRunsPage } from "@/pages/WorkflowRunsPage"

/** Workflow detail: `?tab=overview|editor|runs`. Unknown/missing → editor. */
export function WorkflowPage() {
  const [searchParams] = useSearchParams()
  const tab = parseWorkflowTab(searchParams.get("tab"))
  if (tab === "runs") return <WorkflowRunsPage />
  return <WorkflowEditorPage />
}
