import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ConnectorChangeSet } from "../types.ts"
import type { RallyJson } from "./types.ts"

const META_SKIP = new Set([
  "_rallyAPIMajor",
  "_rallyAPIMinor",
  "_ref",
  "_refObjectUUID",
  "_objectVersion",
  "_typeName",
  "ObjectUUID",
  "VersionId",
  "Subscription",
  "Workspace",
  "Project",
  "CreationDate",
  "CreatedBy",
  "LastUpdateDate",
  "RevisionHistory",
  "Discussion",
  "Changesets",
])

export const ITEM_JSON = "item.json"
export const ITEM_MD = "item.md"
export const COMMENT_MD = "comment.md"

export function writePulledItem(destDir: string, object: RallyJson): void {
  mkdirSync(destDir, { recursive: true })
  writeFileSync(
    join(destDir, ITEM_JSON),
    `${JSON.stringify(object, null, 2)}\n`
  )
  writeFileSync(join(destDir, ITEM_MD), toMarkdown(object))
}

function toMarkdown(object: RallyJson): string {
  const name = stringField(object, "Name") ?? "Untitled"
  const fid = stringField(object, "FormattedID")
  const desc = stringField(object, "Description") ?? ""
  const state = stringField(object, "ScheduleState")
  const lines = [`# ${name}`, ""]
  if (fid) lines.push(`FormattedID: ${fid}`)
  if (state) lines.push(`ScheduleState: ${state}`)
  if (fid || state) lines.push("")
  lines.push(stripHtml(desc) || "_No description._", "")
  return lines.join("\n")
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

function stringField(object: RallyJson, key: string): string | undefined {
  const v = object[key]
  return typeof v === "string" ? v : undefined
}

function readJson(dir: string): RallyJson | undefined {
  const path = join(dir, ITEM_JSON)
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RallyJson
  } catch {
    return undefined
  }
}

function readText(dir: string, name: string): string | undefined {
  const path = join(dir, name)
  if (!existsSync(path)) return undefined
  return readFileSync(path, "utf8")
}

function comparableFields(object: RallyJson): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(object)) {
    if (META_SKIP.has(key)) continue
    if (value === null || value === undefined) continue
    if (typeof value === "object") continue
    out[key] = String(value)
  }
  return out
}

/** Diff work vs base: field edits on item.json and a comment.md add. */
export function diffRallyDirs(
  connectionId: string,
  workDir: string,
  baseDir: string
): ConnectorChangeSet {
  const ops: ConnectorChangeSet["ops"] = []
  const work = readJson(workDir)
  const base = readJson(baseDir)
  const workFields = work ? comparableFields(work) : {}
  const baseFields = base ? comparableFields(base) : {}
  const keys = new Set([...Object.keys(workFields), ...Object.keys(baseFields)])

  for (const key of [...keys].sort()) {
    const after = workFields[key]
    const before = baseFields[key]
    if (after === before) continue
    if (after === undefined) continue
    ops.push({
      op: "field",
      target: key,
      summary: `change ${key}`,
      destructive: false,
      payload: { field: key, before: before ?? null, after },
    })
  }

  const workComment = readText(workDir, COMMENT_MD)?.trim()
  const baseComment = readText(baseDir, COMMENT_MD)?.trim()
  if (workComment && workComment !== baseComment) {
    ops.push({
      op: "comment",
      target: COMMENT_MD,
      summary: "add comment",
      destructive: false,
      payload: { text: workComment },
    })
  }

  const objectId =
    work &&
    (typeof work.ObjectID === "string" || typeof work.ObjectID === "number")
      ? String(work.ObjectID)
      : "unknown"
  const kind =
    work && typeof work._typeName === "string"
      ? work._typeName === "Defect"
        ? "defect"
        : "story"
      : "story"
  const ref = work && typeof work._ref === "string" ? work._ref : undefined

  return {
    v: 1,
    connection: connectionId,
    base: objectId,
    ops: ops.map((op) => ({
      ...op,
      payload: {
        ...(op.payload as object),
        entityKind: kind,
        objectId,
        ...(ref ? { artifactRef: ref } : {}),
      },
    })),
  }
}
