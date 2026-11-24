import type { ConnectorStatus } from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { engineError } from "../kernel/engine-error.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { ConnectorRuntime } from "./runtime.ts"
import type { ConnectorService } from "./service.ts"

export type ConnectorStatusChange = {
  connectorId: string
  name: string
  status: ConnectorStatus
  at: string
  detail?: string
}

export type ConnectorCheckDeps = {
  service: ConnectorService
  runtime: ConnectorRuntime
  bus: UpdateBus
  clock: Clock
  /** Inbox (and others) react to expired / connected (DES-039). */
  onStatusChanged?: (change: ConnectorStatusChange) => void
}

export type ConnectorCheckOutcome = {
  status: ConnectorStatus
  detail?: string
}

/**
 * Run transport check, publish `connector/update` `status_changed`, and
 * notify listeners so an expired sign-in can surface in Inbox (BL-164).
 */
export async function checkConnector(
  deps: ConnectorCheckDeps,
  id: string,
  signal: AbortSignal
): Promise<ConnectorCheckOutcome> {
  const record = deps.service.get(id)
  if (!record) {
    throw engineError("not_found", `Connector not found: ${id}`)
  }

  const result = await deps.runtime.check(id, signal)
  const status: ConnectorStatus = result.ok ? "connected" : "expired"
  const at = new Date(deps.clock.now()).toISOString()
  const detail = result.detail

  deps.service.setStatus(id, { status, checkedAt: at, detail })

  deps.bus.publish("connector/update", {
    kind: "status_changed",
    connectorId: id,
    status,
    checkedAt: at,
    ...(detail ? { detail } : {}),
  })

  deps.onStatusChanged?.({
    connectorId: id,
    name: record.connector.name,
    status,
    at,
    ...(detail ? { detail } : {}),
  })

  return { status, ...(detail ? { detail } : {}) }
}
