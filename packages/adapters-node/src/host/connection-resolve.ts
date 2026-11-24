import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  parseConnectorYaml,
  type ConnectorAuth,
  type ConnectorFile,
  type PublishPolicy,
  type SignInMethod,
} from "@workspace/contracts"
import type { Connection } from "./connection-model.ts"
import { getConnector } from "./connectors/registry.ts"

export type ConnectionLookup = (
  home: string,
  id: string
) => Connection | undefined

/** Test override; production resolves via `connectors/<id>.yaml`. */
let override: ConnectionLookup | undefined

/** Wire in-memory connections for tests. */
export function setConnectionLookup(fn: ConnectionLookup): void {
  override = fn
}

export function resetConnectionLookup(): void {
  override = undefined
}

function signInOf(auth: ConnectorAuth): SignInMethod {
  if (auth === "cookies") return "cookies"
  if (auth === "cli-login") return "cli"
  return "mcp"
}

function policyOf(file: ConnectorFile): PublishPolicy {
  const writable = file.capabilities.some((c) => c.write && c.allowed)
  return writable ? "approve-each-publish" : "read-only"
}

/** Prefer providerId, else a registered adapter whose id matches the file id. */
function adapterIdOf(file: ConnectorFile): string {
  if (file.providerId && getConnector(file.providerId)) return file.providerId
  if (getConnector(file.id)) return file.id
  return file.providerId ?? file.id
}

function scopeOf(file: ConnectorFile): Record<string, string> {
  if (file.transport === "cli") return { command: file.how }
  return { url: file.how }
}

/** Map a v2 connector file to the legacy Connection shape leftover adapters use. */
export function connectionFromConnectorFile(file: ConnectorFile): Connection {
  return {
    id: file.id,
    connector: adapterIdOf(file),
    name: file.name,
    scope: scopeOf(file),
    signIn: signInOf(file.auth),
    refresh: "never",
    policy: policyOf(file),
    serial: false,
  }
}

function readConnectorFile(
  home: string,
  id: string
): ConnectorFile | undefined {
  const path = join(home, "connectors", `${id}.yaml`)
  if (!existsSync(path)) return undefined
  try {
    return parseConnectorYaml(readFileSync(path, "utf8"))
  } catch {
    return undefined
  }
}

export function findConnection(
  home: string,
  id: string
): Connection | undefined {
  if (override) return override(home, id)
  const file = readConnectorFile(home, id)
  return file ? connectionFromConnectorFile(file) : undefined
}

export function requireConnection(home: string, id: string): Connection {
  const conn = findConnection(home, id)
  if (!conn) throw new Error(`unknown connection ${id}`)
  return conn
}
