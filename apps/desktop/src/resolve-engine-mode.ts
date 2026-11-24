import { liveOwner } from "@workspace/adapters-node"

export type EngineMode =
  { kind: "attach"; url: string; token: string } | { kind: "own" }

/**
 * Live daemon in engine.lock → attach over WS; none or stale → own utility host.
 */
export function resolveEngineMode(home: string): EngineMode {
  const owner = liveOwner(home)
  if (owner) return { kind: "attach", url: owner.url, token: owner.token }
  return { kind: "own" }
}
