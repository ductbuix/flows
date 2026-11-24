import type { Connection } from "./connection-model.ts"

export type ConnectionLookup = (
  home: string,
  id: string
) => Connection | undefined

let lookup: ConnectionLookup = () => undefined

/** Wire in-memory connections for tests or a future FCP-backed store. */
export function setConnectionLookup(fn: ConnectionLookup): void {
  lookup = fn
}

export function resetConnectionLookup(): void {
  lookup = () => undefined
}

export function findConnection(
  home: string,
  id: string
): Connection | undefined {
  return lookup(home, id)
}

export function requireConnection(home: string, id: string): Connection {
  const conn = findConnection(home, id)
  if (!conn) throw new Error(`unknown connection ${id}`)
  return conn
}
