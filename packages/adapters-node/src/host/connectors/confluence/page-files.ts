import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const PAGE_MD = "page.md"
/** Page metadata; not `meta.json` (library revision meta owns that name). */
export const PAGE_META = "page.json"

export type PageMeta = {
  id: string
  title: string
  version: number
  space: string
}

export type PageSnapshot = {
  meta: PageMeta
  markdown: string
}

export function readPageSnapshot(dir: string): PageSnapshot | null {
  const metaPath = join(dir, PAGE_META)
  const mdPath = join(dir, PAGE_MD)
  if (!existsSync(metaPath) || !existsSync(mdPath)) return null
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as PageMeta
    if (
      typeof meta.id !== "string" ||
      typeof meta.title !== "string" ||
      typeof meta.version !== "number" ||
      typeof meta.space !== "string"
    ) {
      return null
    }
    return { meta, markdown: readFileSync(mdPath, "utf8") }
  } catch {
    return null
  }
}

export function writePageSnapshot(dir: string, page: PageSnapshot): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, PAGE_META), JSON.stringify(page.meta, null, 2))
  writeFileSync(join(dir, PAGE_MD), page.markdown, "utf8")
}

/** Minimal unified diff for page body updates (DES-026 / BL-054). */
export function unifiedDiff(
  before: string,
  after: string,
  path = PAGE_MD
): string {
  if (before === after) return ""
  const a = before.split("\n")
  const b = after.split("\n")
  const lines = [`--- a/${path}`, `+++ b/${path}`]
  // Whole-file hunk: enough for change-set review without a full LCS.
  lines.push(`@@ -1,${a.length} +1,${b.length} @@`)
  for (const line of a) lines.push(`-${line}`)
  for (const line of b) lines.push(`+${line}`)
  return `${lines.join("\n")}\n`
}
