import { peekLock } from "@workspace/adapters-node"

export type EngineMode =
  | { kind: "attach"; url: string; token: string }
  | { kind: "own" }
  | { kind: "busy"; pid: number }

/** True when the lock owner serves FCP over WebSocket (daemon attach). */
function isWsOwnerUrl(url: string): boolean {
  return /^wss?:\/\//.test(url)
}

/**
 * Live ws(s) daemon in engine.lock → attach; none/stale → own utility host;
 * non-ws owner (inproc / desktop utility) → busy.
 */
export function resolveEngineMode(home: string): EngineMode {
  const owner = peekLock(home)
  if (!owner) return { kind: "own" }
  if (isWsOwnerUrl(owner.url)) {
    return { kind: "attach", url: owner.url, token: owner.token }
  }
  return { kind: "busy", pid: owner.pid }
}
