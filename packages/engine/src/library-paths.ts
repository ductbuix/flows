import { existsSync, readFileSync, readlinkSync } from "node:fs"
import { join } from "node:path"
import type { RefreshRule } from "@workspace/shared"
import { libraryEntityDir } from "./paths.ts"

const REFRESH_MS: Record<Exclude<RefreshRule, "never">, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
}

export type RevisionMeta = {
  pulledAt: string
  title: string
  connection: string
  kind: string
  entityId: string
}

export function isFresh(
  pulledAt: string | undefined,
  rule: RefreshRule
): boolean {
  if (!pulledAt) return false
  if (rule === "never") return true
  const age = Date.now() - Date.parse(pulledAt)
  if (Number.isNaN(age)) return false
  return age <= REFRESH_MS[rule]
}

export function revisionMetaPath(revisionRoot: string): string {
  return join(revisionRoot, "meta.json")
}

export function readRevisionMeta(
  revisionRoot: string
): RevisionMeta | undefined {
  const path = revisionMetaPath(revisionRoot)
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RevisionMeta
  } catch {
    return undefined
  }
}

export function currentRevision(
  home: string,
  connectionId: string,
  kind: string,
  entityId: string
): string | undefined {
  const link = join(
    libraryEntityDir(home, connectionId, kind, entityId),
    "current"
  )
  if (!existsSync(link)) return undefined
  try {
    return readlinkSync(link)
  } catch {
    return undefined
  }
}

/** Entity id as one path segment under resources/ or library/. */
export function entityIdSegment(entityId: string): string {
  return entityId.replaceAll("/", "%2F")
}
