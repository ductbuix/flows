import type { AgentSession } from "@workspace/core"
import type { RpcPeer } from "@workspace/protocol"
import { authenticateIfRequired } from "./authenticate.ts"
import { AcpSession } from "./session-acp.ts"
import {
  ACP_CLIENT_CAPABILITIES,
  type OpenAcpSessionOptions,
} from "./session-options.ts"

export {
  ACP_CLIENT_CAPABILITIES,
  type OpenAcpSessionOptions,
} from "./session-options.ts"
export { toAcpBlock } from "./session-prompt.ts"

/**
 * Run `initialize` + `session/new` on an existing ACP peer and return a
 * session that maps `session/update` to `AgentEvent` (BL-137).
 */
export async function openAcpSession(
  peer: RpcPeer,
  options: OpenAcpSessionOptions
): Promise<AgentSession> {
  const protocolVersion = options.protocolVersion ?? 1
  const clientInfo = options.clientInfo ?? {
    name: "flows",
    version: "0.0.0",
  }

  const initResult = await peer.request(
    "initialize",
    {
      protocolVersion,
      clientCapabilities: ACP_CLIENT_CAPABILITIES,
      clientInfo,
    },
    { signal: options.signal }
  )

  if (options.authMethod) {
    await authenticateIfRequired(
      peer,
      options.authMethod,
      initResult,
      options.signal
    )
  }

  const created = await peer.request(
    "session/new",
    {
      cwd: options.cwd,
      mcpServers: options.mcpServers ?? [],
    },
    { signal: options.signal }
  )

  const sessionId =
    created &&
    typeof created === "object" &&
    "sessionId" in created &&
    typeof (created as { sessionId: unknown }).sessionId === "string"
      ? (created as { sessionId: string }).sessionId
      : undefined

  if (!sessionId) {
    throw new Error("session/new result missing sessionId")
  }

  return new AcpSession(peer, sessionId, options)
}
