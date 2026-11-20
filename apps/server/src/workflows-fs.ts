import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import type { WorkflowSummary } from "@workspace/shared"

export function listWorkflowSummaries(engine: Engine): WorkflowSummary[] {
  const root = join(engine.home, "workflows")
  if (!existsSync(root)) return []

  const summaries: WorkflowSummary[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = workflowDir(engine.home, entry.name)
    if (!existsSync(join(dir, "workflow.yaml"))) continue
    try {
      const wf = engine.loadWorkflow(dir)
      summaries.push({ id: wf.id, goal: wf.goal })
    } catch {
      continue
    }
  }
  return summaries.sort((a, b) => a.id.localeCompare(b.id))
}
