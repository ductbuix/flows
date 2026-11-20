import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import {
  isAgentTask,
  memoryFileNameSchema,
  parseWorkflowYaml,
  replaceMemoryRef,
  type MemoryFileDetail,
  type MemoryFileSummary,
} from "@workspace/shared"
import { hashContent } from "./hash.ts"
import { workflowYamlPath } from "./workflow-files.ts"

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

export function tasksReferencingMemory(
  engine: Engine,
  workflowId: string,
  name: string
): string[] {
  const yamlPath = workflowYamlPath(engine, workflowId)
  if (!existsSync(yamlPath)) return []
  const parsed = parseWorkflowYaml(readFileSync(yamlPath, "utf8"))
  if (!parsed.workflow) return []
  const target = memoryRefPath(name)
  return parsed.workflow.tasks
    .filter((t) => isAgentTask(t) && t.memory?.includes(target))
    .map((t) => t.id)
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
  const path = memoryPath(engine, workflowId, name)
  if (!path || !existsSync(path)) return null
  if (!existsSync(workflowYamlPath(engine, workflowId))) return null
  const content = readFileSync(path, "utf8")
  return {
    name: memoryFileNameSchema.parse(name),
    content,
    hash: hashContent(content),
    referencedBy: tasksReferencingMemory(engine, workflowId, name),
  }
}

export type MemoryWriteResult =
  | { ok: true; detail: MemoryFileDetail }
  | { ok: false; kind: "not_found" | "invalid" | "conflict"; detail?: MemoryFileDetail }
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
  if (!existsSync(workflowYamlPath(engine, workflowId))) {
    return { ok: false, kind: "not_found" }
  }
  const path = memoryPath(engine, workflowId, name)
  if (!path) return { ok: false, kind: "invalid" }

  const root = memoryDir(engine, workflowId)
  mkdirSync(root, { recursive: true })

  if (existsSync(path) && baseHash !== undefined) {
    const diskContent = readFileSync(path, "utf8")
    const diskHash = hashContent(diskContent)
    if (diskHash !== baseHash) {
      return { ok: false, kind: "hash_conflict", diskContent, diskHash }
    }
  }

  writeFileSync(path, content, "utf8")
  const detail = readMemoryFile(engine, workflowId, name)!
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
