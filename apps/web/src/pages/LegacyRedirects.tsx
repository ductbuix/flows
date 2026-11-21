import { Navigate, useParams, useSearchParams } from "react-router"
import { runPath, workflowPath } from "@/lib/paths"

/** `/workflows/:id/runs` → `/workflows/:id?tab=runs` (keeps other params). */
export function LegacyWorkflowRunsRedirect() {
  const { workflowId } = useParams() as { workflowId: string }
  const [searchParams] = useSearchParams()
  const next = new URLSearchParams(searchParams)
  next.set("tab", "runs")
  const qs = next.toString()
  return <Navigate to={`${workflowPath(workflowId)}?${qs}`} replace />
}

/** `/workflows/:id/runs/:runId` → `/runs/:runId` (keeps search params). */
export function LegacyRunRedirect() {
  const { runId } = useParams() as { runId: string }
  const [searchParams] = useSearchParams()
  const qs = searchParams.toString()
  return <Navigate to={`${runPath(runId)}${qs ? `?${qs}` : ""}`} replace />
}
