import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  templateProblems,
  type TemplateText,
  type Workflow,
} from "@workspace/contracts"
import { workflowDir } from "../paths.ts"

function templateTexts(home: string, graph: Workflow): TemplateText[] {
  const root = join(workflowDir(home, graph.id), "nodes")
  const out: TemplateText[] = []
  const read = (path: string): string | undefined =>
    existsSync(path) ? readFileSync(path, "utf8") : undefined
  for (const n of graph.nodes) {
    for (const file of ["prompt.md", "system.md", "user.md"]) {
      const text = read(join(root, n.id, file))
      if (text !== undefined) out.push({ nodeId: n.id, label: file, text })
    }
  }
  return out
}

/** Fails a start when a template name is ambiguous (DES-032). */
export function assertNodeTemplatesValid(home: string, graph: Workflow): void {
  const problems = templateProblems(
    graph.nodes,
    graph.edges,
    templateTexts(home, graph)
  )
  const first = problems[0]
  if (first) {
    throw new Error(`node ${first.nodeId} ${first.label}: ${first.message}`)
  }
}
