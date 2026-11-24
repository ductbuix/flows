import type { LibItem, ProviderDescriptor } from "@workspace/contracts"

export type KindFilter = "all" | string

export function filterItems(
  items: readonly LibItem[],
  kind: KindFilter,
  search: string,
  tags: readonly string[] = []
): LibItem[] {
  const q = search.trim().toLowerCase()
  return items.filter((i) => {
    if (kind !== "all" && i.source !== kind) return false
    if (tags.length > 0 && !tags.every((t) => i.tags.includes(t))) return false
    if (!q) return true
    return (
      i.title.toLowerCase().includes(q) ||
      i.remoteId?.toLowerCase().includes(q) === true ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    )
  })
}

export function countBySource(
  items: readonly LibItem[],
  source: KindFilter
): number {
  if (source === "all") return items.length
  return items.filter((i) => i.source === source).length
}

/** Provider tabs plus a Local files tab when any item is local-only. */
export function sourceTabs(
  items: readonly LibItem[],
  providers: readonly ProviderDescriptor[]
): Array<{ id: string; label: string }> {
  const ids = [...new Set(items.map((i) => i.source))].filter(
    (s) => s !== "local"
  )
  const tabs = ids.map((id) => ({
    id,
    label: providers.find((p) => p.id === id)?.label ?? `${id} (removed)`,
  }))
  if (items.some((i) => i.source === "local")) {
    tabs.push({ id: "local", label: "Local files" })
  }
  return tabs
}

export function splitTag(tag: string): [string, string] {
  const i = tag.indexOf(":")
  if (i <= 0) return ["", tag]
  return [tag.slice(0, i), tag.slice(i + 1)]
}
