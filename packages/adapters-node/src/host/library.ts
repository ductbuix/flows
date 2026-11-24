import { randomUUID } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import {
  resourcesJsonSchema,
  type Connection,
  type ResourcesJson,
} from "@workspace/contracts"
import { getConnector } from "./connectors/registry.ts"
import {
  currentRevision,
  entityIdSegment,
  isFresh,
  readRevisionMeta,
  revisionMetaPath,
  type RevisionMeta,
} from "./library-paths.ts"
import { assertLibraryHasSpace } from "./library-usage.ts"
import { libraryEntityDir } from "./paths.ts"

/** Pseudo run id for manual pulls outside a run (BL-043). */
export const LIBRARY_EVENT_RUN_ID = "library"

export type ScopeEntity = {
  kind: string
  entityId: string
  title: string
}

export type PullEntityResult = {
  revision: string
  title: string
  pulledAt: string
  fromCache: boolean
}

/** Connection scope entity: first kind plus non-ambient scope fields. */
export function resolveScopeEntity(connection: Connection): ScopeEntity {
  const connector = getConnector(connection.connector)
  if (!connector) {
    throw new Error(`unknown connector ${connection.connector}`)
  }
  const desc = connector.describe()
  const kind = desc.entityKinds[0]
  if (!kind) {
    throw new Error(`connector ${connection.connector} has no entity kinds`)
  }
  const skip = new Set([
    "ambient",
    "failPull",
    "signedOut",
    "remote",
    "host",
    "command",
    "url",
    "domain",
  ])
  const parts: string[] = []
  for (const field of desc.scopeFields) {
    if (skip.has(field)) continue
    const value = connection.scope[field]
    if (value) parts.push(value)
  }
  if (parts.length === 0) {
    throw new Error(`connection ${connection.id} has no scope entity id`)
  }
  return { kind, entityId: parts.join("/"), title: connection.name }
}

function setCurrent(entityRoot: string, revision: string): void {
  const tmp = join(entityRoot, `.current-${randomUUID()}`)
  symlinkSync(revision, tmp)
  renameSync(tmp, join(entityRoot, "current"))
}

/**
 * Pull when missing or older than the refresh rule. A refresh adds a
 * revision and never edits one (DES-026).
 */
export async function pullEntity(options: {
  home: string
  connection: Connection
  kind: string
  entityId: string
  title?: string
  force?: boolean
}): Promise<PullEntityResult> {
  const { home, connection, kind, entityId, force } = options
  const title = options.title ?? connection.name
  const entityRoot = libraryEntityDir(home, connection.id, kind, entityId)
  const existing = currentRevision(home, connection.id, kind, entityId)
  if (existing && !force) {
    const meta = readRevisionMeta(join(entityRoot, existing))
    if (meta && isFresh(meta.pulledAt, connection.refresh)) {
      return {
        revision: existing,
        title: meta.title,
        pulledAt: meta.pulledAt,
        fromCache: true,
      }
    }
  }

  const connector = getConnector(connection.connector)
  if (!connector) {
    throw new Error(`unknown connector ${connection.connector}`)
  }
  const check = await connector.check(connection, home)
  if (!check.ok) throw new Error(check.message)

  assertLibraryHasSpace(home)

  mkdirSync(entityRoot, { recursive: true })
  const staging = join(entityRoot, `.pull-${randomUUID()}`)
  mkdirSync(staging, { recursive: true })
  try {
    const pulled = await connector.pull({
      connection,
      entityKind: kind,
      entityId,
      entityRoot,
      destDir: staging,
      home,
    })
    const revision = pulled?.revision?.trim() || randomUUID()
    const destDir = join(entityRoot, revision)
    if (!existsSync(destDir)) {
      renameSync(staging, destDir)
    } else {
      rmSync(staging, { recursive: true, force: true })
    }
    const pulledAt = new Date().toISOString()
    const meta: RevisionMeta = {
      pulledAt,
      title,
      connection: connection.id,
      kind,
      entityId,
    }
    writeFileSync(revisionMetaPath(destDir), JSON.stringify(meta, null, 2))
    setCurrent(entityRoot, revision)
    return { revision, title, pulledAt, fromCache: false }
  } catch (err) {
    rmSync(staging, { recursive: true, force: true })
    throw err
  }
}

/** Link each pin under resources/ and write index.json + resources.json. */
export function linkRunResources(
  home: string,
  runRoot: string,
  resources: ResourcesJson
): void {
  const resourcesDir = join(runRoot, "resources")
  rmSync(resourcesDir, { recursive: true, force: true })
  mkdirSync(resourcesDir, { recursive: true })
  for (const pin of resources.pins) {
    const target = join(
      libraryEntityDir(home, pin.connection, pin.kind, pin.entityId),
      pin.revision
    )
    if (!existsSync(target)) {
      throw new Error(
        `pinned revision missing: ${pin.connection}/${pin.kind}/${pin.entityId}@${pin.revision}`
      )
    }
    const linkDir = join(resourcesDir, pin.connection, pin.kind)
    mkdirSync(linkDir, { recursive: true })
    symlinkSync(target, join(linkDir, entityIdSegment(pin.entityId)))
  }
  writeFileSync(
    join(resourcesDir, "index.json"),
    JSON.stringify({ v: 1, entries: resources.pins }, null, 2)
  )
  writeFileSync(
    join(runRoot, "resources.json"),
    JSON.stringify(resources, null, 2)
  )
}

export function readResourcesJson(runRoot: string): ResourcesJson | undefined {
  const path = join(runRoot, "resources.json")
  if (!existsSync(path)) return undefined
  try {
    return resourcesJsonSchema.parse(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return undefined
  }
}
