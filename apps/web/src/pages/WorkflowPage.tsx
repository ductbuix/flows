import { useSearchParams } from "react-router"
import { parseWorkflowTab } from "@/lib/paths"
import { WorkflowEditorPage } from "@/pages/editor/WorkflowEditorPage"
import { WorkflowOverviewPage } from "./WorkflowOverviewPage"
import { WorkflowRunsPage } from "./WorkflowRunsPage"

/** Workflow detail: `?tab=overview|editor|runs`. Default Overview (BL-037). */
export function WorkflowPage() {
  const [searchParams] = useSearchParams()
  const tab = parseWorkflowTab(searchParams.get("tab")) ?? "overview"
  if (tab === "runs") return <WorkflowRunsPage />
  if (tab === "editor") return <WorkflowEditorPage />
  return <WorkflowOverviewPage />
}
