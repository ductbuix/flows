import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import {
  connectionEnvName,
  connectionSchema,
  type Connection,
  type ConnectionInput,
  type TaskUsesEntry,
  type Workflow,
} from "@workspace/shared"
import { getConnector } from "./connectors/registry.ts"
import { connectionDir, workflowDir, connectionsDir } from "./paths.ts"
import { removeSignIn } from "./secrets.ts"
import { loadWorkflowFile } from "./workflow.ts"

export type ConnectionStoreError =
  | { kind: "not_found" }
  | { kind: "exists" }
  | { kind: "invalid"; message: string }
  | { kind: "env_conflict"; envName: string; otherId: string }
  | { kind: "unknown_connector"; connector: string }
  | { kind: "in_use"; workflowIds: string[] }

export type ConnectionStoreResult<T> =
  { ok: true; value: T } | { ok: false; error: ConnectionStoreError }

function connectionYamlPath(home: string, id: string): string {
  return join(connectionDir(home, id), "connection.yaml")
}

export function listConnections(home: string): Connection[] {
  const root = connectionsDir(home)
  if (!existsSync(root)) return []
  const out: Connection[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const conn = readConnection(home, entry.name)
    if (conn) out.push(conn)
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

export function readConnection(
  home: string,
  id: string
): Connection | undefined {
  const path = connectionYamlPath(home, id)
  if (!existsSync(path)) return undefined
  try {
    const raw = parseYaml(readFileSync(path, "utf8"))
    return connectionSchema.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Scan connection directory names (not only parsed yaml) so a hand-edited
 * folder whose slug maps to the same `RESOURCE_*` env is rejected.
 */
function findEnvConflict(
  home: string,
  id: string
): { envName: string; otherId: string } | undefined {
  const root = connectionsDir(home)
  if (!existsSync(root)) return undefined
  const envName = connectionEnvName(id)
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === id) continue
    if (connectionEnvName(entry.name) === envName) {
      return { envName, otherId: entry.name }
    }
  }
  return undefined
}

export function createConnection(
  home: string,
  input: ConnectionInput
): ConnectionStoreResult<Connection> {
  const parsed = connectionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "invalid", message: parsed.error.message },
    }
  }
  const conn = parsed.data
  if (!getConnector(conn.connector)) {
    return {
      ok: false,
      error: { kind: "unknown_connector", connector: conn.connector },
    }
  }
  if (existsSync(connectionYamlPath(home, conn.id))) {
    return { ok: false, error: { kind: "exists" } }
  }
  const conflict = findEnvConflict(home, conn.id)
  if (conflict) {
    return {
      ok: false,
      error: {
        kind: "env_conflict",
        envName: conflict.envName,
        otherId: conflict.otherId,
      },
    }
  }
  writeConnectionFile(home, conn)
  return { ok: true, value: conn }
}

export function updateConnection(
  home: string,
  id: string,
  input: ConnectionInput
): ConnectionStoreResult<Connection> {
  if (!existsSync(connectionYamlPath(home, id))) {
    return { ok: false, error: { kind: "not_found" } }
  }
  const parsed = connectionSchema.safeParse({ ...input, id })
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "invalid", message: parsed.error.message },
    }
  }
  const conn = parsed.data
  if (conn.id !== id) {
    return {
      ok: false,
      error: { kind: "invalid", message: "id in body must match path" },
    }
  }
  if (!getConnector(conn.connector)) {
    return {
      ok: false,
      error: { kind: "unknown_connector", connector: conn.connector },
    }
  }
  writeConnectionFile(home, conn)
  return { ok: true, value: conn }
}

export function deleteConnection(
  home: string,
  id: string
): ConnectionStoreResult<void> {
  if (!existsSync(connectionYamlPath(home, id))) {
    return { ok: false, error: { kind: "not_found" } }
  }
  const workflowIds = workflowsUsingConnection(home, id)
  if (workflowIds.length > 0) {
    return { ok: false, error: { kind: "in_use", workflowIds } }
  }
  rmSync(connectionDir(home, id), { recursive: true, force: true })
  removeSignIn(home, id)
  return { ok: true, value: undefined }
}

function writeConnectionFile(home: string, conn: Connection): void {
  const dir = connectionDir(home, conn.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(connectionYamlPath(home, conn.id), stringifyYaml(conn), "utf8")
}

/** Workflow ids whose tasks `uses` this connection. */
export function workflowsUsingConnection(
  home: string,
  connectionId: string
): string[] {
  const root = join(home, "workflows")
  if (!existsSync(root)) return []
  const ids: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = workflowDir(home, entry.name)
    if (!existsSync(join(dir, "workflow.yaml"))) continue
    try {
      const wf = loadWorkflowFile(dir)
      if (workflowUsesConnection(wf, connectionId)) ids.push(wf.id)
    } catch {
      continue
    }
  }
  return ids.sort()
}

export function workflowUsesConnection(
  workflow: Workflow,
  connectionId: string
): boolean {
  if (
    collectWorkflowUses(workflow).some((u) => u.connection === connectionId)
  ) {
    return true
  }
  return workflow.tasks.some(
    (t) => t.kind === "publish" && t.connection === connectionId
  )
}

export function collectWorkflowUses(workflow: Workflow): TaskUsesEntry[] {
  const out: TaskUsesEntry[] = []
  for (const task of workflow.tasks) {
    // Publish names its connection separately; uses on it are ignored.
    if (task.kind === "publish") continue
    if (!task.uses) continue
    out.push(...task.uses)
  }
  return out
}
