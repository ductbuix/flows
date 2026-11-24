import {
  connectorToYaml,
  safeParseConnectorYaml,
  toConnectorSummary,
  type ConnectorFile,
  type ConnectorSummary,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import { setCapabilityAllowed } from "./capabilities.ts"

export const CONNECTORS_GLOB = "connectors/*.yaml"

const CONNECTOR_PATH_RE = /^connectors\/([^/]+)\.yaml$/

export function connectorPath(id: string): string {
  return `connectors/${id}.yaml`
}

export function connectorIdFromPath(path: string): string | null {
  return CONNECTOR_PATH_RE.exec(path.replace(/\\/g, "/"))?.[1] ?? null
}

export type ConnectorRecord = {
  connector: ConnectorFile
  hash: string
  path: string
}

export type ConnectorServiceDeps = {
  docs: DocumentStore
}

export function createConnectorService(
  deps: ConnectorServiceDeps
): ConnectorService {
  return new ConnectorService(deps)
}

export class ConnectorService {
  constructor(private readonly deps: ConnectorServiceDeps) {}

  list(): ConnectorSummary[] {
    return this.listRecords()
      .map((r) => toConnectorSummary(r.connector))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  get(id: string): ConnectorRecord | null {
    return this.readRecord(id)
  }

  save(
    connector: ConnectorFile,
    baseHash?: string
  ): { hash: string } | { conflict: ConnectorRecord } {
    const path = connectorPath(connector.id)
    const text = connectorToYaml(connector)
    const written = this.deps.docs.write(path, text, { baseHash })
    if (!written.ok) {
      const current = this.readRecord(connector.id)
      if (!current) {
        throw engineError("conflict", "Stale baseHash")
      }
      return { conflict: current }
    }
    return { hash: written.hash }
  }

  remove(id: string): void {
    const result = this.deps.docs.remove(connectorPath(id))
    if (!result.ok) {
      throw engineError("not_found", `Connector not found: ${id}`)
    }
  }

  setCapability(
    id: string,
    name: string,
    allowed: boolean,
    baseHash: string
  ): { hash: string } | { conflict: ConnectorRecord } {
    const current = this.readRecord(id)
    if (!current) {
      throw engineError("not_found", `Connector not found: ${id}`)
    }
    const next = setCapabilityAllowed(current.connector, name, allowed)
    if (!next) {
      throw engineError("invalid_params", `Capability not found: ${name}`)
    }
    return this.save(next, baseHash)
  }

  private listRecords(): ConnectorRecord[] {
    const out: ConnectorRecord[] = []
    for (const path of this.deps.docs.list(CONNECTORS_GLOB)) {
      const id = connectorIdFromPath(path)
      if (!id) continue
      const record = this.tryReadRecord(id)
      if (record) out.push(record)
    }
    return out
  }

  private readRecord(id: string): ConnectorRecord | null {
    const path = connectorPath(id)
    const disk = this.deps.docs.read(path)
    if (!disk) return null
    const parsed = safeParseConnectorYaml(disk.text)
    if (!parsed.success) {
      throw engineError("invalid_params", `Invalid connector file: ${id}`, {
        issues: parsed.error.issues.map((i) => ({ path: i.path })),
      })
    }
    if (parsed.data.id !== id) {
      throw engineError(
        "invalid_params",
        `Connector id mismatch: file ${id} declares ${parsed.data.id}`
      )
    }
    return { connector: parsed.data, hash: disk.hash, path }
  }

  /** List skips unreadable files; get/save still reject them. */
  private tryReadRecord(id: string): ConnectorRecord | null {
    try {
      return this.readRecord(id)
    } catch {
      return null
    }
  }
}
