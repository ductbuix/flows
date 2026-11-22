import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import {
  memoryFileNameSchema,
  parseNodeWorkflowYaml,
  replaceMemoryRef,
  type MemoryFileDetail,
  type MemoryFileSummary,
} from "@workspace/shared"
import { hashContent } from "./hash.ts"
import { workflowYamlPath } from "./workflow-files.ts"
import {
  readWorkflowScopedFile,
  writeWorkflowScopedFile,
} from "./workflow-scoped-files.ts"

function memoryDir(engine: Engine, workflowId: string): string {
  return join(workflowDir(engine.home, workflowId), "memory")
}

function memoryPath(
  engine: Engine,
  workflowId: string,
  name: string
): string | null {
  const parsed = memoryFileNameSchema.safeParse(name)
  if (!parsed.success) return null
  return join(memoryDir(engine, workflowId), parsed.data)
}

function memoryRefPath(name: string): string {
  return `memory/${name}`
}

/** Ids of the Agent nodes that list this memory file. */
export function tasksReferencingMemory(
  engine: Engine,
  workflowId: string,
  name: string
): string[] {
  const yamlPath = workflowYamlPath(engine, workflowId)
  if (!existsSync(yamlPath)) return []
  const parsed = parseNodeWorkflowYaml(readFileSync(yamlPath, "utf8"))
  if (!parsed.workflow) return []
  const target = memoryRefPath(name)
  return parsed.workflow.nodes
    .filter((n) => n.kind === "agent" && n.memory?.includes(target))
    .map((n) => n.id)
}

export function listMemoryFiles(
  engine: Engine,
  workflowId: string
): MemoryFileSummary[] | null {
  const dir = workflowDir(engine.home, workflowId)
  if (!existsSync(join(dir, "workflow.yaml"))) return null
  const root = memoryDir(engine, workflowId)
  if (!existsSync(root)) return []
  const files: MemoryFileSummary[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const name = memoryFileNameSchema.safeParse(entry.name)
    if (!name.success) continue
    const content = readFileSync(join(root, name.data), "utf8")
    files.push({
      name: name.data,
      hash: hashContent(content),
      referencedBy: tasksReferencingMemory(engine, workflowId, name.data),
    })
  }
  return files.sort((a, b) => a.name.localeCompare(b.name))
}

export function readMemoryFile(
  engine: Engine,
  workflowId: string,
  name: string
): MemoryFileDetail | null {
  const parsed = memoryFileNameSchema.safeParse(name)
  if (!parsed.success) return null
  const file = readWorkflowScopedFile(
    engine,
    workflowId,
    memoryRefPath(parsed.data)
  )
  if (!file) return null
  return {
    name: parsed.data,
    content: file.content,
    hash: file.hash,
    referencedBy: tasksReferencingMemory(engine, workflowId, parsed.data),
  }
}

export type MemoryWriteResult =
  | { ok: true; detail: MemoryFileDetail }
  | {
      ok: false
      kind: "not_found" | "invalid" | "conflict"
      detail?: MemoryFileDetail
    }
  | {
      ok: false
      kind: "hash_conflict"
      diskContent: string
      diskHash: string
    }

export function writeMemoryFile(
  engine: Engine,
  workflowId: string,
  name: string,
  content: string,
  baseHash?: string
): MemoryWriteResult {
  const parsed = memoryFileNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, kind: "invalid" }
  const result = writeWorkflowScopedFile(
    engine,
    workflowId,
    memoryRefPath(parsed.data),
    content,
    baseHash
  )
  if (!result.ok) return result
  const detail = readMemoryFile(engine, workflowId, parsed.data)
  if (!detail) return { ok: false, kind: "not_found" }
  return { ok: true, detail }
}

export type MemoryDeleteResult =
  | { ok: true; referencedBy: string[] }
  | { ok: false; kind: "not_found" | "invalid" }

export function deleteMemoryFile(
  engine: Engine,
  workflowId: string,
  name: string
): MemoryDeleteResult {
  const path = memoryPath(engine, workflowId, name)
  if (!path) return { ok: false, kind: "invalid" }
  if (!existsSync(path)) return { ok: false, kind: "not_found" }
  const referencedBy = tasksReferencingMemory(engine, workflowId, name)
  unlinkSync(path)
  return { ok: true, referencedBy }
}

export type MemoryRenameResult =
  | { ok: true; detail: MemoryFileDetail }
  | { ok: false; kind: "not_found" | "invalid" | "exists" }

export function renameMemoryFile(
  engine: Engine,
  workflowId: string,
  name: string,
  newName: string,
  updateReferences: boolean
): MemoryRenameResult {
  const from = memoryPath(engine, workflowId, name)
  const to = memoryPath(engine, workflowId, newName)
  if (!from || !to) return { ok: false, kind: "invalid" }
  if (!existsSync(from)) return { ok: false, kind: "not_found" }
  if (existsSync(to)) return { ok: false, kind: "exists" }

  renameSync(from, to)

  if (updateReferences) {
    const yamlPath = workflowYamlPath(engine, workflowId)
    if (existsSync(yamlPath)) {
      const yaml = readFileSync(yamlPath, "utf8")
      const next = replaceMemoryRef(
        yaml,
        memoryRefPath(name),
        memoryRefPath(newName)
      )
      writeFileSync(yamlPath, next, "utf8")
    }
  }

  const detail = readMemoryFile(engine, workflowId, newName)!
  return { ok: true, detail }
}
