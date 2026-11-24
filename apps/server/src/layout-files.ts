import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import {
  layoutFileSchema,
  parseNodeWorkflowYaml,
  type LayoutFile,
} from "@workspace/contracts"
import { workflowYamlPath } from "./workflow-files.ts"

const EMPTY: LayoutFile = { version: 1, nodes: {} }

function layoutPath(engine: Engine, workflowId: string): string {
  return join(workflowDir(engine.home, workflowId), "workflow.layout.json")
}

/** Missing or unreadable file reads as empty. */
export function readLayout(engine: Engine, workflowId: string): LayoutFile {
  const path = layoutPath(engine, workflowId)
  if (!existsSync(path)) return { ...EMPTY, nodes: {} }
  try {
    return layoutFileSchema.parse(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return { ...EMPTY, nodes: {} }
  }
}

function nodeIds(engine: Engine, workflowId: string): Set<string> {
  const yamlPath = workflowYamlPath(engine, workflowId)
  if (!existsSync(yamlPath)) return new Set()
  const parsed = parseNodeWorkflowYaml(readFileSync(yamlPath, "utf8"))
  return new Set((parsed.workflow?.nodes ?? []).map((n) => n.id))
}

function writeAtomic(path: string, layout: LayoutFile): void {
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(layout, null, 2) + "\n", "utf8")
  renameSync(tmp, path)
}

/** Writes the layout, dropping ids that are not nodes in `workflow.yaml`. */
export function writeLayout(
  engine: Engine,
  workflowId: string,
  layout: LayoutFile
): LayoutFile | null {
  if (!existsSync(workflowYamlPath(engine, workflowId))) return null
  const ids = nodeIds(engine, workflowId)
  const next: LayoutFile = {
    ...layout,
    nodes: Object.fromEntries(
      Object.entries(layout.nodes).filter(([id]) => ids.has(id))
    ),
  }
  writeAtomic(layoutPath(engine, workflowId), next)
  return next
}

/** Moves entries for renamed node ids; no-op without a layout file. */
export function moveLayoutIds(
  engine: Engine,
  workflowId: string,
  moves: readonly { from: string; to: string }[]
): void {
  const path = layoutPath(engine, workflowId)
  if (moves.length === 0 || !existsSync(path)) return
  const layout = readLayout(engine, workflowId)
  let changed = false
  for (const { from, to } of moves) {
    const pos = layout.nodes[from]
    if (!pos) continue
    delete layout.nodes[from]
    layout.nodes[to] = pos
    changed = true
  }
  if (changed) writeAtomic(path, layout)
}
