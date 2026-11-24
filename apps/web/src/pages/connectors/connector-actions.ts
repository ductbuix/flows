import type { ConnectorFile, ConnectorStatus } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type ConnectorActionResult =
  | { ok: true; hash?: string }
  | { ok: false; kind: "conflict" }
  | { ok: false; kind: "error"; message: string }

export type ConnectorCheckActionResult =
  | { ok: true; status: ConnectorStatus; detail?: string }
  | { ok: false; kind: "error"; message: string }

export type ConnectorSignInActionResult =
  | { ok: true; signedIn: true }
  | { ok: true; cancelled: true }
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

export async function checkConnector(
  client: FlowsClient,
  id: string
): Promise<ConnectorCheckActionResult> {
  try {
    const result = await client.call("connector/check", { id })
    return {
      ok: true,
      status: result.status,
      ...(result.detail !== undefined ? { detail: result.detail } : {}),
    }
  } catch (err) {
    return { ok: false, kind: "error", message: errorMessage(err) }
  }
}

export async function signInConnector(
  client: FlowsClient,
  id: string
): Promise<ConnectorSignInActionResult> {
  try {
    const result = await client.call("connector/sign_in", { id })
    if ("cancelled" in result && result.cancelled) {
      return { ok: true, cancelled: true }
    }
    return { ok: true, signedIn: true }
  } catch (err) {
    return { ok: false, kind: "error", message: errorMessage(err) }
  }
}

export async function signOutConnector(
  client: FlowsClient,
  id: string
): Promise<ConnectorActionResult> {
  try {
    await client.call("connector/sign_out", { id })
    return { ok: true }
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
