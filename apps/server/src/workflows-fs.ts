import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import { parseNodeWorkflowYaml, type WorkflowSummary } from "@workspace/shared"
import { nodesEnabled } from "./node-workflow-files.ts"

export function listWorkflowSummaries(engine: Engine): WorkflowSummary[] {
  const root = join(engine.home, "workflows")
  if (!existsSync(root)) return []

  const summaries: WorkflowSummary[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = workflowDir(engine.home, entry.name)
    if (!existsSync(join(dir, "workflow.yaml"))) continue
    if (nodesEnabled()) {
      // An invalid or old-format file still lists, so its error is reachable
      // (DES-033 Old files).
      const parsed = parseNodeWorkflowYaml(
        readFileSync(join(dir, "workflow.yaml"), "utf8")
      )
      const wf = parsed.workflow
      summaries.push({
        id: entry.name,
        ...(wf?.name ? { name: wf.name } : {}),
        ...(wf?.goal ? { goal: wf.goal } : {}),
        taskCount: wf?.nodes.length ?? 0,
      })
      continue
    }
    try {
      const wf = engine.loadWorkflow(dir)
      summaries.push({
        id: wf.id,
        ...(wf.name ? { name: wf.name } : {}),
        goal: wf.goal,
        taskCount: wf.tasks.length,
      })
    } catch {
      continue
    }
  }
  return summaries.sort((a, b) => a.id.localeCompare(b.id))
}
