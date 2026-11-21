import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
} from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import {
  workItemSchema,
  type WorkItem,
  type WorkItemSummary,
} from "@workspace/shared"
import { workItemDir, workItemsRoot } from "./paths.ts"
import {
  hashText,
  newWorkItemId,
  workItemAttachmentsDir,
  workItemNotesPath,
  workItemToYaml,
  workItemTrashStamp,
  workItemYamlPath,
  writeAtomic,
} from "./workitem-io.ts"

export { hashText, writeAtomic, newWorkItemId } from "./workitem-io.ts"

function parseItemYaml(raw: string): WorkItem {
  return workItemSchema.parse(parseYaml(raw) ?? {})
}

export function readWorkItem(
  home: string,
  id: string
): { item: WorkItem; yaml: string; hash: string } | null {
  const path = workItemYamlPath(home, id)
  if (!existsSync(path)) return null
  const yaml = readFileSync(path, "utf8")
  return { item: parseItemYaml(yaml), yaml, hash: hashText(yaml) }
}

export function listWorkItemSummaries(home: string): WorkItemSummary[] {
  const root = workItemsRoot(home)
  if (!existsSync(root)) return []
  const out: WorkItemSummary[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === ".trash") continue
    const loaded = readWorkItem(home, entry.name)
    if (!loaded) continue
    const { item } = loaded
    out.push({
      id: item.id,
      title: item.title,
      source: item.source,
      workflowId: item.workflowId,
      updatedAt: item.updatedAt,
    })
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export type CreateWorkItemInput = {
  title: string
  workflowId?: string
  inputs?: Record<string, string>
  notes?: string
  now?: Date
}

export function createWorkItem(
  home: string,
  input: CreateWorkItemInput
): { item: WorkItem; hash: string } {
  const id = newWorkItemId(home, input.title)
  const now = (input.now ?? new Date()).toISOString()
  const item = workItemSchema.parse({
    id,
    title: input.title,
    source: { kind: "adhoc" },
    workflowId: input.workflowId,
    inputs: input.inputs ?? {},
    links: [],
    createdAt: now,
    updatedAt: now,
  })
  mkdirSync(workItemAttachmentsDir(home, id), { recursive: true })
  const yaml = workItemToYaml(item)
  writeAtomic(workItemYamlPath(home, id), yaml)
  writeAtomic(workItemNotesPath(home, id), input.notes ?? "")
  return { item, hash: hashText(yaml) }
}

export type UpdateWorkItemInput = {
  title: string
  workflowId?: string
  inputs: Record<string, string>
  baseHash: string
  now?: Date
}

export type UpdateWorkItemResult =
  | { ok: true; item: WorkItem; hash: string }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; item: WorkItem; hash: string }

export function updateWorkItem(
  home: string,
  id: string,
  input: UpdateWorkItemInput
): UpdateWorkItemResult {
  const loaded = readWorkItem(home, id)
  if (!loaded) return { ok: false, kind: "not_found" }
  if (loaded.hash !== input.baseHash) {
    return { ok: false, kind: "conflict", item: loaded.item, hash: loaded.hash }
  }
  const now = (input.now ?? new Date()).toISOString()
  const item = workItemSchema.parse({
    ...loaded.item,
    title: input.title,
    workflowId: input.workflowId,
    inputs: input.inputs,
    updatedAt: now,
  })
  const yaml = workItemToYaml(item)
  writeAtomic(workItemYamlPath(home, id), yaml)
  return { ok: true, item, hash: hashText(yaml) }
}

export type DeleteWorkItemResult =
  { ok: true; trashPath: string } | { ok: false; kind: "not_found" }

/** Move the folder to workitems/.trash/; never touches runs (BL-038). */
export function deleteWorkItem(
  home: string,
  id: string,
  at: Date = new Date()
): DeleteWorkItemResult {
  const dir = workItemDir(home, id)
  if (!existsSync(workItemYamlPath(home, id))) {
    return { ok: false, kind: "not_found" }
  }
  const trashRoot = join(workItemsRoot(home), ".trash")
  mkdirSync(trashRoot, { recursive: true })
  const stamp = workItemTrashStamp(at)
  let name = `${id}-${stamp}`
  let n = 0
  while (existsSync(join(trashRoot, name))) {
    n += 1
    name = `${id}-${stamp}-${n}`
  }
  const dest = join(trashRoot, name)
  renameSync(dir, dest)
  return { ok: true, trashPath: dest }
}
