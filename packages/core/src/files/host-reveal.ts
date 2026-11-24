import { engineError } from "../kernel/engine-error.ts"
import type { FcpConnection } from "../rpc/initialize.ts"

type HostRevealPeer = {
  request(method: string, params?: unknown): Promise<unknown>
}

function hasRevealCapability(connection: FcpConnection): boolean {
  const caps = connection.clientCapabilities as
    { host?: { revealPath?: boolean } } | undefined
  return caps?.host?.revealPath === true
}

/**
 * `file/reveal` hook: ask the client via `host/reveal_path` when it
 * declared `host.revealPath` (DES-040).
 */
export function createPeerHostReveal(
  peer: HostRevealPeer,
  connection: FcpConnection,
  toAbsolutePath: (storePath: string) => string
): (storePath: string) => Promise<void> {
  return async (storePath) => {
    if (!hasRevealCapability(connection)) {
      throw engineError("unsupported", "Reveal is not available on this host")
    }
    await peer.request("host/reveal_path", {
      path: toAbsolutePath(storePath),
    })
  }
}
