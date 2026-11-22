import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"

export function workflowYamlPath(engine: Engine, workflowId: string): string {
  return join(workflowDir(engine.home, workflowId), "workflow.yaml")
}
