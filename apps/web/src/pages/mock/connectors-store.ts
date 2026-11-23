import { useSyncExternalStore } from "react"
import { CONNECTORS, type Auth, type Connector, type Transport } from "./connectors-data"

/** In-memory connectors; lost on reload. */
let list: Connector[] = CONNECTORS
const listeners = new Set<() => void>()
const set = (next: Connector[]) => {
  list = next
  listeners.forEach((fn) => fn())
}
const edit = (id: string, fn: (c: Connector) => Connector) => set(list.map((c) => (c.id === id ? fn(c) : c)))

export const useConnectors = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => list
  )

/** The connector a Library provider fetches through, if any. */
export const connectorFor = (all: Connector[], providerId: string) => all.find((c) => c.providerId === providerId)

export const markConnected = (id: string) =>
  edit(id, (c) => ({ ...c, status: "connected", checked: "just now", account: c.account ?? "duc.bui" }))

export const markChecked = (id: string) => edit(id, (c) => ({ ...c, checked: "just now" }))

export const disconnect = (id: string) => edit(id, (c) => ({ ...c, status: "off", checked: "never" }))

export const setAllowed = (id: string, name: string, allowed: boolean) =>
  edit(id, (c) => ({ ...c, capabilities: c.capabilities.map((x) => (x.name === name ? { ...x, allowed } : x)) }))

export const removeConnector = (id: string) => set(list.filter((c) => c.id !== id))

export function addConnector(name: string, transport: Transport, how: string, auth: Auth) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `connector-${list.length + 1}`
  set([
    ...list,
    {
      id, name, transport, how, auth,
      status: auth === "none" ? "connected" : "off",
      checked: "never",
      capabilities: [{ name: "read", desc: "Read data (discovered on first connect)", write: false, allowed: true }],
      consumers: [],
    },
  ])
  return id
}
