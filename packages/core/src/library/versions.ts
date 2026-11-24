import {
  libItemToYaml,
  libVersionMetaToYaml,
  parseLibVersionMetaYaml,
  safeParseLibItemYaml,
  type LibItem,
  type LibItemDisk,
  type LibVersion,
  type LibVersionMeta,
} from "@workspace/contracts"
import { hashUtf8Text } from "../kernel/hash.ts"
import type { DocumentStore } from "../ports/document-store.ts"

export const ITEM_YAML = "item.yaml"
export const VERSION_META = ".version.yaml"

const VERSION_DIR_RE = /^\/?library\/([^/]+)\/v(\d+)\/(.*)$/

export function itemDir(id: string): string {
  return `library/${id}`
}

export function itemYamlPath(id: string): string {
  return `${itemDir(id)}/${ITEM_YAML}`
}

export function versionDir(id: string, n: number): string {
  return `${itemDir(id)}/v${n}`
}

export function versionMetaPath(id: string, n: number): string {
  return `${versionDir(id, n)}/${VERSION_META}`
}

export function versionFilePath(id: string, n: number, rel: string): string {
  return `${versionDir(id, n)}/${rel.replace(/^\/+/, "")}`
}

/** Stable hash of pulled file map (paths sorted). */
export function contentHashOf(files: Readonly<Record<string, string>>): string {
  const keys = Object.keys(files).sort((a, b) => a.localeCompare(b))
  let body = ""
  for (const key of keys) {
    body += `${key}\0${files[key] ?? ""}\n`
  }
  return hashUtf8Text(body)
}

export function readItemDisk(
  docs: DocumentStore,
  id: string
): LibItemDisk | null {
  const disk = docs.read(itemYamlPath(id))
  if (!disk) return null
  const parsed = safeParseLibItemYaml(disk.text)
  if (!parsed.success || parsed.data.id !== id) return null
  return parsed.data
}

export function listVersionMetas(
  docs: DocumentStore,
  id: string
): LibVersionMeta[] {
  const prefix = `${itemDir(id)}/`
  const found = new Map<number, LibVersionMeta>()
  for (const path of docs.list(`${prefix}v*/${VERSION_META}`)) {
    const m = VERSION_DIR_RE.exec(path)
    if (!m || m[1] !== id) continue
    const n = Number(m[2])
    const file = docs.read(path)
    if (!file) continue
    try {
      const meta = parseLibVersionMetaYaml(file.text)
      if (meta.n === n) found.set(n, meta)
    } catch {
      // skip broken meta
    }
  }
  return [...found.values()].sort((a, b) => b.n - a.n)
}

export function toLibItem(disk: LibItemDisk, versions: LibVersion[]): LibItem {
  return { ...disk, versions }
}

export function newestVersionN(versions: readonly LibVersionMeta[]): number {
  return versions.reduce((max, v) => Math.max(max, v.n), 0)
}

/**
 * After a new version lands: advance `current` when it was tracking the
 * previous newest; leave it when pinned to an older version.
 */
export function nextCurrent(
  previousCurrent: number,
  previousNewest: number,
  newN: number
): number {
  if (previousNewest === 0) return newN
  if (previousCurrent === previousNewest) return newN
  return previousCurrent
}

export function writeItemDisk(docs: DocumentStore, item: LibItemDisk): void {
  docs.write(itemYamlPath(item.id), libItemToYaml(item))
}

/** Drop `versions` (wire-only) before writing `item.yaml`. */
export function toDisk(item: LibItem): LibItemDisk {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    source: item.source,
    ...(item.remoteId !== undefined ? { remoteId: item.remoteId } : {}),
    ...(item.remoteUrl !== undefined ? { remoteUrl: item.remoteUrl } : {}),
    tags: item.tags,
    current: item.current,
  }
}

/** Delete every file under `library/<id>/`. */
export function removeItemTree(docs: DocumentStore, id: string): void {
  const prefix = `${itemDir(id)}/`
  for (const path of docs.list(`${prefix}**`)) {
    docs.remove(path)
  }
  // Cover item.yaml when the glob only matches nested paths.
  docs.remove(itemYamlPath(id))
}

export function writeVersion(
  docs: DocumentStore,
  id: string,
  meta: LibVersionMeta,
  files: Readonly<Record<string, string>>
): void {
  docs.write(versionMetaPath(id, meta.n), libVersionMetaToYaml(meta))
  for (const [rel, text] of Object.entries(files)) {
    docs.write(versionFilePath(id, meta.n, rel), text)
  }
}

/** Files under `library/<id>/v<n>/` excluding `.version.yaml`. */
export function readVersionFiles(
  docs: DocumentStore,
  id: string,
  n: number
): Record<string, string> {
  const prefix = `${versionDir(id, n)}/`
  const files: Record<string, string> = {}
  for (const path of docs.list(`${prefix}**`)) {
    const normalized = path.replace(/\\/g, "/").replace(/^\//, "")
    if (!normalized.startsWith(prefix)) continue
    if (
      normalized.endsWith(`/${VERSION_META}`) ||
      normalized.endsWith(VERSION_META)
    )
      continue
    const rel = normalized.slice(prefix.length)
    if (!rel || rel.includes("..")) continue
    const file = docs.read(normalized)
    if (file) files[rel] = file.text
  }
  return files
}

export function listItemIds(docs: DocumentStore): string[] {
  const ids = new Set<string>()
  for (const path of docs.list("library/*/item.yaml")) {
    const parts = path.replace(/\\/g, "/").replace(/^\//, "").split("/")
    if (
      parts.length === 3 &&
      parts[0] === "library" &&
      parts[2] === ITEM_YAML
    ) {
      ids.add(parts[1]!)
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b))
}
