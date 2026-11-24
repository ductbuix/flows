import {
  connectionSchema,
  type Connection,
  type ConnectionInput,
} from "./connection-model.ts"
import {
  resetConnectionLookup,
  setConnectionLookup,
} from "./connection-resolve.ts"
import { getConnector } from "./connectors/registry.ts"

const store = new Map<string, Map<string, Connection>>()

export function installTestConnectionStore(): void {
  store.clear()
  setConnectionLookup((home, id) => store.get(home)?.get(id))
}

export function resetTestConnectionStore(): void {
  store.clear()
  resetConnectionLookup()
}

/** Register an in-memory connection (tests only; no disk). */
export function registerTestConnection(
  home: string,
  input: ConnectionInput
): Connection {
  const parsed = connectionSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }
  const connector = getConnector(parsed.data.connector)
  if (!connector) {
    throw new Error(`unknown connector ${parsed.data.connector}`)
  }
  let homeMap = store.get(home)
  if (!homeMap) {
    homeMap = new Map()
    store.set(home, homeMap)
  }
  homeMap.set(parsed.data.id, parsed.data)
  return parsed.data
}

export function updateTestConnection(home: string, conn: Connection): void {
  store.get(home)?.set(conn.id, conn)
}
