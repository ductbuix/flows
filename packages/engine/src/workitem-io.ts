import { createHash, randomBytes } from "node:crypto"
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { stringify as stringifyYaml } from "yaml"
import { workItemIdSchema, type WorkItem } from "@workspace/shared"
import { workItemDir } from "./paths.ts"

/** SHA-256 of utf8 text (same as server hashContent). */
export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}

/** Write via temp file then rename (BL-038). */
export function writeAtomic(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = join(
    dirname(path),
    `.${Date.now()}-${randomBytes(4).toString("hex")}.tmp`
  )
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}

export function workItemYamlPath(home: string, id: string): string {
  return join(workItemDir(home, id), "workitem.yaml")
}

export function workItemNotesPath(home: string, id: string): string {
  return join(workItemDir(home, id), "notes.md")
}

export function workItemAttachmentsDir(home: string, id: string): string {
  return join(workItemDir(home, id), "attachments")
}

export function workItemToYaml(item: WorkItem): string {
  return stringifyYaml(item, { lineWidth: 0 })
}

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug.length > 0 ? slug : "item"
}

/** Generate a unique slug id under workitems/ (BL-038). */
export function newWorkItemId(home: string, title: string): string {
  const base = slugifyTitle(title)
  let id = base
  let n = 0
  while (existsSync(workItemDir(home, id))) {
    n += 1
    id = `${base}-${n}`
  }
  return workItemIdSchema.parse(id)
}

/** UTC stamp for trash folder names: `YYYYMMDDTHHMMSSZ`. */
export function workItemTrashStamp(at: Date = new Date()): string {
  return at
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z")
}
