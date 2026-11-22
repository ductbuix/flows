import { useParams } from "react-router"
import { NodeEditorPage } from "./NodeEditorPage"

/** The node editor for the workflow in the URL. */
export function WorkflowEditorPage() {
  const { workflowId } = useParams() as { workflowId: string }
  return <NodeEditorPage workflowId={workflowId} />
}
