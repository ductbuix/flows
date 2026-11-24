import type { ConnectorFile } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type ConnectorActionResult =
  | { ok: true; hash?: string }
  | { ok: false; kind: "conflict" }
  | { ok: false; kind: "error"; message: string }

export async function saveConnector(
  client: FlowsClient,
  connector: ConnectorFile,
  baseHash?: string
): Promise<ConnectorActionResult> {
  try {
    const result = await client.call("connector/save", {
      connector,
      ...(baseHash !== undefined ? { baseHash } : {}),
    })
    return { ok: true, hash: result.hash }
  } catch (err) {
    if (isConflictError(err)) return { ok: false, kind: "conflict" }
    return { ok: false, kind: "error", message: errorMessage(err) }
  }
}

export async function removeConnector(
  client: FlowsClient,
  id: string
): Promise<ConnectorActionResult> {
  try {
    await client.call("connector/remove", { id })
    return { ok: true }
  } catch (err) {
    if (isConflictError(err)) return { ok: false, kind: "conflict" }
    return { ok: false, kind: "error", message: errorMessage(err) }
  }
}

export async function setCapability(
  client: FlowsClient,
  params: {
    id: string
    name: string
    allowed: boolean
    baseHash: string
  }
): Promise<ConnectorActionResult> {
  try {
    const result = await client.call("connector/set_capability", params)
    return { ok: true, hash: result.hash }
  } catch (err) {
    if (isConflictError(err)) return { ok: false, kind: "conflict" }
    return { ok: false, kind: "error", message: errorMessage(err) }
  }
}

export function slugFromName(name: string, fallback: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  )
}
