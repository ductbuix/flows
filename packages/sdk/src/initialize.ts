import {
  FCP_VERSION,
  initializeMethod,
  type FcpMethodParams,
  type FcpMethodResult,
} from "@workspace/contracts"

export type InitializeParams = FcpMethodParams<typeof initializeMethod>
export type InitializeResult = FcpMethodResult<typeof initializeMethod>
export type ClientInfo = InitializeParams["clientInfo"]
export type ClientCapabilities = InitializeParams["clientCapabilities"]

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
