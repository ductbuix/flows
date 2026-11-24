import { join } from "node:path"
import { workflowDir, type Host } from "@workspace/adapters-node"

export function workflowYamlPath(engine: Host, workflowId: string): string {
  return join(workflowDir(engine.home, workflowId), "workflow.yaml")
}
