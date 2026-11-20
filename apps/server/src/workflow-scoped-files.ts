import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve, sep } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import {
  isAllowedWorkflowFilePath,
  type WorkflowFileDetail,
} from "@workspace/shared"
import { hashContent } from "./hash.ts"
import { workflowYamlPath } from "./workflow-files.ts"

export type ScopedFileWriteResult =
  | { ok: true; detail: WorkflowFileDetail }
  | { ok: false; kind: "not_found" | "invalid" }
  | {
      ok: false
      kind: "hash_conflict"
      diskContent: string
      diskHash: string
    }

/** Resolve a workflow-relative path; null if outside the workflow dir. */
export function resolveWorkflowFilePath(
  engine: Engine,
  workflowId: string,
  rel: string
): string | null {
  if (!isAllowedWorkflowFilePath(rel)) return null
  const root = resolve(workflowDir(engine.home, workflowId))
  const full = resolve(root, ...rel.split("/"))
  if (full !== root && !full.startsWith(root + sep)) return null
  return full
}

export function readWorkflowScopedFile(
  engine: Engine,
  workflowId: string,
  rel: string
): WorkflowFileDetail | null {
  if (!existsSync(workflowYamlPath(engine, workflowId))) return null
  const path = resolveWorkflowFilePath(engine, workflowId, rel)
  if (!path || !existsSync(path)) return null
  const content = readFileSync(path, "utf8")
  return { path: rel, content, hash: hashContent(content) }
}

export function writeWorkflowScopedFile(
  engine: Engine,
  workflowId: string,
  rel: string,
  content: string,
  baseHash?: string
): ScopedFileWriteResult {
  if (!existsSync(workflowYamlPath(engine, workflowId))) {
    return { ok: false, kind: "not_found" }
  }
  const path = resolveWorkflowFilePath(engine, workflowId, rel)
  if (!path) return { ok: false, kind: "invalid" }

  if (existsSync(path) && baseHash !== undefined) {
    const diskContent = readFileSync(path, "utf8")
    const diskHash = hashContent(diskContent)
    if (diskHash !== baseHash) {
      return { ok: false, kind: "hash_conflict", diskContent, diskHash }
    }
  }

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, "utf8")
  return {
    ok: true,
    detail: { path: rel, content, hash: hashContent(content) },
  }
}
