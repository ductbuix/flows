import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { workflowDir, type Engine } from "@workspace/adapters-node"
import {
  NODE_KINDS,
  workflowDetailSchema,
  parseNodeWorkflowYaml,
  type WorkflowDetail,
} from "@workspace/shared"
import { moveLayoutIds, readLayout } from "./layout-files.ts"
import { hashContent } from "./hash.ts"
import {
  orphanNodeFolderIds,
  trashStamp,
  uniqueTrashDir,
} from "./node-trash.ts"
import { workflowYamlPath } from "./workflow-files.ts"

function detailOf(
  engine: Engine,
  workflowId: string,
  yaml: string
): WorkflowDetail {
  const parsed = parseNodeWorkflowYaml(yaml)
  return workflowDetailSchema.parse({
    id: workflowId,
    yaml,
    hash: hashContent(yaml),
    workflow: parsed.workflow,
    errors: parsed.errors,
    layout: readLayout(engine, workflowId),
  })
}

export function readNodeWorkflowDetail(
  engine: Engine,
  workflowId: string
): WorkflowDetail | null {
  const path = workflowYamlPath(engine, workflowId)
  if (!existsSync(path)) return null
  return detailOf(engine, workflowId, readFileSync(path, "utf8"))
}

export type WriteNodeWorkflowResult =
  | { ok: true; detail: WorkflowDetail }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; diskYaml: string; diskHash: string }
  | { ok: false; kind: "invalid"; detail: WorkflowDetail }
  | { ok: false; kind: "trash_failed"; path: string; detail: WorkflowDetail }

const filesByKind = new Map<
  string,
  readonly { path: string; required: boolean }[]
>(NODE_KINDS.map((k) => [k.kind, k.files]))

function isDir(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

export function writeNodeWorkflowYaml(
  engine: Engine,
  workflowId: string,
  yaml: string,
  baseHash: string,
  renames: readonly { from: string; to: string }[] = []
): WriteNodeWorkflowResult {
  const path = workflowYamlPath(engine, workflowId)
  if (!existsSync(path)) return { ok: false, kind: "not_found" }

  const diskYaml = readFileSync(path, "utf8")
  const diskHash = hashContent(diskYaml)
  if (diskHash !== baseHash) {
    return { ok: false, kind: "conflict", diskYaml, diskHash }
  }

  const parsed = parseNodeWorkflowYaml(yaml)
  if (!parsed.workflow || parsed.errors.length > 0) {
    return {
      ok: false,
      kind: "invalid",
      detail: detailOf(engine, workflowId, yaml),
    }
  }

  const wfRoot = workflowDir(engine.home, workflowId)
  const nodesRoot = join(wfRoot, "nodes")
  const newIds = new Set(parsed.workflow.nodes.map((n) => n.id))
  const diskIds = new Set(
    (parseNodeWorkflowYaml(diskYaml).workflow?.nodes ?? []).map((n) => n.id)
  )

  // A rename counts only when the old id left and the new id arrived.
  const moves = renames.filter(
    (r) => diskIds.has(r.from) && !newIds.has(r.from) && newIds.has(r.to)
  )
  const renamedFrom = new Set(moves.map((r) => r.from))
  moveLayoutIds(engine, workflowId, moves)

  writeFileSync(path, yaml, "utf8")
  const written = detailOf(engine, workflowId, yaml)

  for (const r of moves) {
    const from = join(nodesRoot, r.from)
    const to = join(nodesRoot, r.to)
    if (isDir(from) && !existsSync(to)) renameSync(from, to)
  }

  const removed = [...diskIds].filter(
    (id) => !newIds.has(id) && !renamedFrom.has(id)
  )
  const toTrash = new Set([
    ...removed,
    ...orphanNodeFolderIds(nodesRoot, newIds),
  ])
  const stamp = trashStamp()
  for (const id of [...toTrash].sort()) {
    const source = join(nodesRoot, id)
    if (!isDir(source)) continue
    const dest = uniqueTrashDir(nodesRoot, id, stamp)
    try {
      mkdirSync(dirname(dest), { recursive: true })
      renameSync(source, dest)
    } catch {
      return {
        ok: false,
        kind: "trash_failed",
        path: `nodes/.trash/${id}-${stamp}/`,
        detail: written,
      }
    }
  }

  // Create the kind's required node files; never overwrite.
  for (const node of parsed.workflow.nodes) {
    for (const f of filesByKind.get(node.kind) ?? []) {
      if (!f.required) continue
      const file = join(nodesRoot, node.id, f.path)
      if (existsSync(file)) continue
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, "", "utf8")
    }
  }

  return { ok: true, detail: written }
}
