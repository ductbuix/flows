import type { LibItemDisk } from "@workspace/contracts"
import { isCapabilityAllowed } from "../connectors/capabilities.ts"
import type { ConnectorRuntime } from "../connectors/runtime.ts"
import type { ConnectorService } from "../connectors/service.ts"
import { engineError } from "../kernel/engine-error.ts"
import type { ProviderService } from "./providers.ts"

export type LibraryFetchResult = {
  files: Readonly<Record<string, string>>
  note?: string
}

export type LibraryPushResult = {
  note?: string
}

/** Fetches or pushes remote content for a library item (DES-041 / BL-205). */
export type LibraryFetcher = {
  fetch(item: LibItemDisk, signal: AbortSignal): Promise<LibraryFetchResult>
  push(
    item: LibItemDisk,
    files: Readonly<Record<string, string>>,
    signal: AbortSignal
  ): Promise<LibraryPushResult>
}

/**
 * Runs the first allowed read/write capability on the connector linked to
 * the item's provider. Fetch stdout may be JSON `{ files, note? }` or plain
 * text for the provider's first layout path.
 */
export function createConnectorLibraryFetcher(deps: {
  connectors: ConnectorService
  runtime: ConnectorRuntime
  providers: ProviderService
}): LibraryFetcher {
  return {
    async fetch(item, signal) {
      const { connectorId, capability } = resolveCapability(deps, item, false)
      const result = await deps.runtime.call(
        connectorId,
        capability.name,
        [item.remoteId!],
        signal
      )
      if (result.exitCode !== 0) {
        throw engineError(
          "internal",
          result.stderr.trim() || `Fetch failed (exit ${result.exitCode})`
        )
      }
      return parseFetchStdout(result.stdout, item, deps.providers)
    },
    async push(item, files, signal) {
      const { connectorId, capability } = resolveCapability(deps, item, true)
      const result = await deps.runtime.call(
        connectorId,
        capability.name,
        [item.remoteId!, JSON.stringify({ files })],
        signal
      )
      if (result.exitCode !== 0) {
        throw engineError(
          "internal",
          result.stderr.trim() || `Push failed (exit ${result.exitCode})`
        )
      }
      const note = parsePushNote(result.stdout)
      return note ? { note } : {}
    },
  }
}

function resolveCapability(
  deps: {
    connectors: ConnectorService
  },
  item: LibItemDisk,
  write: boolean
): { connectorId: string; capability: { name: string } } {
  if (item.source === "local" || !item.remoteId) {
    throw engineError(
      "unsupported",
      write ? "Item has no remote to push" : "Item has no remote to pull"
    )
  }
  const connectorId = deps.connectors
    .list()
    .find((c) => c.providerId === item.source)?.id
  if (!connectorId) {
    throw engineError("not_found", `No connector for provider: ${item.source}`)
  }
  const record = deps.connectors.get(connectorId)
  if (!record) {
    throw engineError("not_found", `Connector not found: ${connectorId}`)
  }
  const capability = record.connector.capabilities.find(
    (c) =>
      Boolean(c.write) === write &&
      isCapabilityAllowed(record.connector, c.name)
  )
  if (!capability) {
    throw engineError(
      "policy_denied",
      `No ${write ? "write" : "read"} capability on connector: ${connectorId}`
    )
  }
  return { connectorId, capability }
}

function parseFetchStdout(
  stdout: string,
  item: LibItemDisk,
  providers: ProviderService
): LibraryFetchResult {
  const trimmed = stdout.trim()
  if (trimmed.startsWith("{")) {
    try {
      const raw = JSON.parse(trimmed) as {
        files?: Record<string, string>
        note?: string
      }
      if (raw.files && typeof raw.files === "object") {
        return {
          files: raw.files,
          ...(typeof raw.note === "string" ? { note: raw.note } : {}),
        }
      }
    } catch {
      // fall through to plain text
    }
  }
  const provider = providers.list().find((p) => p.id === item.source)
  const first = provider?.layout[0] ?? "content.txt"
  return { files: { [first]: stdout }, note: "Pulled" }
}

function parsePushNote(stdout: string): string | undefined {
  const trimmed = stdout.trim()
  if (!trimmed.startsWith("{")) return trimmed || undefined
  try {
    const raw = JSON.parse(trimmed) as { note?: string }
    return typeof raw.note === "string" ? raw.note : undefined
  } catch {
    return trimmed || undefined
  }
}
