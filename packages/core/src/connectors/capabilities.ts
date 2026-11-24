import type { Capability, ConnectorFile } from "@workspace/contracts"

/** Whether a named capability is currently allowed. */
export function isCapabilityAllowed(
  connector: ConnectorFile,
  name: string
): boolean {
  const cap = connector.capabilities.find((c) => c.name === name)
  return cap?.allowed === true
}

/** Toggle one capability's `allowed` flag; returns null if the name is unknown. */
export function setCapabilityAllowed(
  connector: ConnectorFile,
  name: string,
  allowed: boolean
): ConnectorFile | null {
  let found = false
  const capabilities: Capability[] = connector.capabilities.map((c) => {
    if (c.name !== name) return c
    found = true
    return { ...c, allowed }
  })
  if (!found) return null
  return { ...connector, capabilities }
}
