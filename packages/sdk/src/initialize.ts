import { FCP_VERSION } from "@workspace/contracts"

/** Client capability flags from DES-040. Unknown keys are ignored by the engine. */
export type ClientCapabilities = {
  readonly "host.revealPath"?: boolean
  readonly "host.browserSignIn"?: boolean
  readonly "host.notifications"?: boolean
  readonly "updates.coalesced"?: boolean
}

export type ClientInfo = {
  readonly name: string
  readonly version: string
}

export type InitializeParams = {
  readonly protocolVersion: typeof FCP_VERSION
  readonly clientInfo: ClientInfo
  readonly clientCapabilities: ClientCapabilities
}

export type InitializeResult = {
  readonly protocolVersion: number
  readonly engineInfo: ClientInfo
  readonly engineCapabilities: Record<string, unknown>
  readonly workspace: { readonly home: string; readonly id: string }
}

export function buildInitializeParams(
  clientInfo: ClientInfo,
  capabilities: ClientCapabilities
): InitializeParams {
  return {
    protocolVersion: FCP_VERSION,
    clientInfo,
    clientCapabilities: capabilities,
  }
}

export function isSupportedProtocolVersion(version: number): boolean {
  return version === FCP_VERSION
}
