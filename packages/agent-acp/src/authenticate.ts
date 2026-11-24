import { engineError } from "@workspace/core"
import type { RpcPeer } from "@workspace/protocol"

function authMethodIds(initResult: unknown): string[] {
  if (!initResult || typeof initResult !== "object") return []
  const methods = (initResult as { authMethods?: unknown }).authMethods
  if (!Array.isArray(methods)) return []
  const ids: string[] = []
  for (const method of methods) {
    if (method && typeof method === "object" && "id" in method) {
      const id = (method as { id: unknown }).id
      if (typeof id === "string") ids.push(id)
    }
  }
  return ids
}

/**
 * Call `authenticate` when the profile method appears in initialize
 * authMethods. Failure is a typed `needs_trust` EngineError (BL-140).
 */
export async function authenticateIfRequired(
  peer: RpcPeer,
  authMethod: string,
  initResult: unknown,
  signal?: AbortSignal
): Promise<void> {
  if (!authMethodIds(initResult).includes(authMethod)) return
  try {
    await peer.request("authenticate", { methodId: authMethod }, { signal })
  } catch (cause) {
    throw engineError(
      "needs_trust",
      `Agent authentication failed (${authMethod})`,
      { authMethod, cause: cause instanceof Error ? cause.message : cause }
    )
  }
}
