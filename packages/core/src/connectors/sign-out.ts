import { engineError } from "../kernel/engine-error.ts"
import type { SecretStore } from "../ports/secret-store.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import { cookiesSecretKey, tokenSecretKey } from "./api-auth.ts"
import type { ConnectorCheckDeps } from "./check.ts"
import type { ConnectorService } from "./service.ts"

export type ConnectorSignOutDeps = {
  service: ConnectorService
  secrets: SecretStore
  bus: UpdateBus
  clock: ConnectorCheckDeps["clock"]
  onStatusChanged?: ConnectorCheckDeps["onStatusChanged"]
}

/** Clear saved sign-in secrets and mark the connector off (DES-040). */
export function signOutConnector(
  deps: ConnectorSignOutDeps,
  id: string
): { status: "off" } {
  const record = deps.service.get(id)
  if (!record) {
    throw engineError("not_found", `Connector not found: ${id}`)
  }

  clearConnectorSecrets(deps.secrets, id)

  const at = new Date(deps.clock.now()).toISOString()
  deps.service.setStatus(id, { status: "off", checkedAt: at })
  deps.bus.publish("connector/update", {
    kind: "status_changed",
    connectorId: id,
    status: "off",
    checkedAt: at,
  })
  deps.onStatusChanged?.({
    connectorId: id,
    name: record.connector.name,
    status: "off",
    at,
  })

  return { status: "off" }
}

export function clearConnectorSecrets(
  secrets: SecretStore,
  connectorId: string
): void {
  secrets.delete(cookiesSecretKey(connectorId))
  secrets.delete(tokenSecretKey(connectorId))
}
