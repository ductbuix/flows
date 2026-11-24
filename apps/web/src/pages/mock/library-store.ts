import { useSyncExternalStore } from "react"
import {
  LIBRARY,
  type LibAsset,
  type LibItem,
  type LibKind,
} from "./library-data"
import {
  DEFAULT_PROVIDERS,
  tagsOf,
  type Match,
  type Provider,
} from "./library-providers"

/** In-memory Library; lost on reload. */
let list: LibItem[] = LIBRARY
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function set(next: LibItem[]) {
  list = next
  listeners.forEach((fn) => fn())
}

const edit = (id: string, fn: (i: LibItem) => LibItem) =>
  set(list.map((i) => (i.id === id ? fn(i) : i)))

export const useLibrary = () => useSyncExternalStore(subscribe, () => list)

/** Reads the remote into a new local version. Never writes to the remote. */
export function fetchItem(id: string) {
  edit(id, (i) => {
    const n = (i.versions[0]?.n ?? 0) + 1
    return {
      ...i,
      current: n,
      versions: [
        {
          n,
          at: "2026-11-23 09:41",
          note: "Changes since the last fetch",
          size: i.versions[0]?.size ?? "—",
        },
        ...i.versions,
      ],
    }
  })
}

export const pinVersion = (id: string, n: number) =>
  edit(id, (i) => ({ ...i, current: n }))

export const addTag = (id: string, tag: string) =>
  edit(id, (i) => (i.tags.includes(tag) ? i : { ...i, tags: [...i.tags, tag] }))

export const removeTag = (id: string, tag: string) =>
  edit(id, (i) => ({ ...i, tags: i.tags.filter((t) => t !== tag) }))

export const removeItem = (id: string) => set(list.filter((i) => i.id !== id))

/** A new local-only item (added from disk). */
export function addItem(
  kind: LibKind,
  title: string,
  tags: string[],
  assets: LibAsset[] = []
) {
  const id = `new-${list.length + 1}`
  set([
    {
      id,
      kind,
      title,
      source: "local",
      tags,
      assets,
      versions: [
        { n: 1, at: "2026-11-23 09:41", note: "Added from disk", size: "—" },
      ],
      current: 1,
      usedBy: [],
    },
    ...list,
  ])
  return id
}

export const linkCard = (id: string, cardId: string) =>
  edit(id, (i) =>
    i.usedBy.includes(cardId) ? i : { ...i, usedBy: [...i.usedBy, cardId] }
  )

export const unlinkCard = (id: string, cardId: string) =>
  edit(id, (i) => ({ ...i, usedBy: i.usedBy.filter((c) => c !== cardId) }))

/** Links a local-only copy to a remote item (no fetch yet). */
export const linkRemote = (id: string, m: Match) =>
  edit(id, (i) => ({
    ...i,
    source: m.provider.id,
    remoteId: m.id,
    remoteUrl: m.url,
  }))

/** The local copy and its versions stay; only the link goes. */
export const unlinkRemote = (id: string) =>
  edit(id, (i) => ({
    ...i,
    source: "local",
    remoteId: undefined,
    remoteUrl: undefined,
  }))

/** Adds a linked item and does its first fetch: the provider's layout becomes v1. */
export function addRemote(m: Match) {
  const id = `${m.provider.id}-${m.id}`
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
  set([
    {
      id,
      kind: m.provider.icon,
      title: m.title,
      source: m.provider.id,
      remoteId: m.id,
      remoteUrl: m.url,
      tags: tagsOf(m),
      assets: m.provider.layout.map((name) => ({
        name,
        kind: name.endsWith(".md")
          ? "md"
          : name.endsWith(".json")
            ? "json"
            : name.endsWith(".html")
              ? "html"
              : name.match(/\.(png|jpg)$/)
                ? "image"
                : "file",
        size: "—",
      })),
      versions: [
        { n: 1, at: "2026-11-23 09:41", note: "First fetch", size: "—" },
      ],
      current: 1,
      usedBy: [],
    },
    ...list,
  ])
  return id
}

let providers: Provider[] = DEFAULT_PROVIDERS
const pListeners = new Set<() => void>()
const pSubscribe = (fn: () => void) => {
  pListeners.add(fn)
  return () => pListeners.delete(fn)
}
const setProviders = (next: Provider[]) => {
  // The catch-all Web page matcher always goes last.
  providers = [
    ...next.filter((p) => p.id !== "web"),
    ...next.filter((p) => p.id === "web"),
  ]
  pListeners.forEach((fn) => fn())
}
export const useProviders = () =>
  useSyncExternalStore(pSubscribe, () => providers)

export const addProvider = (p: Provider) =>
  setProviders([...providers.filter((x) => x.id !== p.id), p])

/** Items already fetched stay in the Library; they just cannot be fetched until it is added back. */
export const removeProvider = (id: string) =>
  setProviders(providers.filter((p) => p.id !== id))

/** Writable providers only: sends local edits to the remote as a new version. */
export function pushItem(id: string) {
  edit(id, (i) => {
    const n = (i.versions[0]?.n ?? 0) + 1
    return {
      ...i,
      current: n,
      versions: [
        {
          n,
          at: "2026-11-23 09:41",
          note: "Pushed local changes to the remote",
          size: i.versions[0]?.size ?? "—",
        },
        ...i.versions,
      ],
    }
  })
}
