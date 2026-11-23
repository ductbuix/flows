import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs"
import { join } from "node:path"
import {
  attachmentNameSchema,
  type WorkItemAttachment,
} from "@workspace/shared"
import { getDocumentStore } from "./document-store.ts"
import {
  hashText,
  workItemAttachmentsDir,
  workItemNotesPath,
  workItemYamlPath,
  writeAtomic,
} from "./workitem-io.ts"

export function readWorkItemNotes(
  home: string,
  id: string
): { content: string; hash: string } | null {
  if (!existsSync(workItemYamlPath(home, id))) return null
  const path = workItemNotesPath(home, id)
  const disk = getDocumentStore().read(path)
  const content = disk?.text ?? ""
  return { content, hash: disk?.hash ?? hashText("") }
}

export type WriteNotesResult =
  | { ok: true; content: string; hash: string }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; content: string; hash: string }

export function writeWorkItemNotes(
  home: string,
  id: string,
  content: string,
  baseHash?: string
): WriteNotesResult {
  if (!existsSync(workItemYamlPath(home, id)))
    return { ok: false, kind: "not_found" }
  const path = workItemNotesPath(home, id)
  const written = getDocumentStore().write(path, content, { baseHash })
  if (!written.ok) {
    return {
      ok: false,
      kind: "conflict",
      content: written.text,
      hash: written.hash,
    }
  }
  return { ok: true, content: written.text, hash: written.hash }
}

export function listWorkItemAttachments(
  home: string,
  id: string
): WorkItemAttachment[] | null {
  if (!existsSync(workItemYamlPath(home, id))) return null
  const root = workItemAttachmentsDir(home, id)
  if (!existsSync(root)) return []
  const files: WorkItemAttachment[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const name = attachmentNameSchema.safeParse(entry.name)
    if (!name.success) continue
    files.push({
      name: name.data,
      size: statSync(join(root, name.data)).size,
    })
  }
  return files.sort((a, b) => a.name.localeCompare(b.name))
}

export type AttachmentWriteResult =
  | { ok: true; attachment: WorkItemAttachment }
  | { ok: false; kind: "not_found" | "invalid" }

export function writeWorkItemAttachment(
  home: string,
  id: string,
  name: string,
  data: Buffer
): AttachmentWriteResult {
  if (!existsSync(workItemYamlPath(home, id)))
    return { ok: false, kind: "not_found" }
  const parsed = attachmentNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, kind: "invalid" }
  const dir = workItemAttachmentsDir(home, id)
  mkdirSync(dir, { recursive: true })
  writeAtomic(join(dir, parsed.data), data)
  return {
    ok: true,
    attachment: { name: parsed.data, size: data.byteLength },
  }
}

export type AttachmentDeleteResult =
  { ok: true } | { ok: false; kind: "not_found" | "invalid" }

export function deleteWorkItemAttachment(
  home: string,
  id: string,
  name: string
): AttachmentDeleteResult {
  if (!existsSync(workItemYamlPath(home, id)))
    return { ok: false, kind: "not_found" }
  const parsed = attachmentNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, kind: "invalid" }
  const path = join(workItemAttachmentsDir(home, id), parsed.data)
  if (!existsSync(path)) return { ok: false, kind: "not_found" }
  unlinkSync(path)
  return { ok: true }
}
