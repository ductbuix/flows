import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { workflowDir, type Host } from "@workspace/adapters-node"
import {
  parseNodeWorkflowYaml,
  type WorkflowSummary,
} from "@workspace/contracts"

export function listWorkflowSummaries(engine: Host): WorkflowSummary[] {
  const root = join(engine.home, "workflows")
  if (!existsSync(root)) return []

  const summaries: WorkflowSummary[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = workflowDir(engine.home, entry.name)
    if (!existsSync(join(dir, "workflow.yaml"))) continue
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
  }
  return summaries.sort((a, b) => a.id.localeCompare(b.id))
}
