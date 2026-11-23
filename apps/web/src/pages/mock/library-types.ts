/** Library types: local copies of everything tasks refer to. Nothing leaves the machine. */

export type LibKind =
  | "repo"
  | "confluence"
  | "rally"
  | "ci"
  | "logs"
  | "web"
  | "image"
  | "html"
  | "other"

export const KIND_LABEL: Record<LibKind, string> = {
  repo: "Repositories",
  confluence: "Confluence",
  rally: "Rally",
  ci: "Builds",
  logs: "Logs",
  web: "Web pages",
  image: "Images",
  html: "HTML",
  other: "Other",
}

export const KIND_SINGULAR: Record<LibKind, string> = {
  repo: "Repository",
  confluence: "Confluence page",
  rally: "Rally item",
  ci: "Build",
  logs: "Log query",
  web: "Web page",
  image: "Image",
  html: "HTML file",
  other: "File",
}

export type LibAsset = {
  /** Path inside the item's own folder, like `attachments/failure.png`. */
  name: string
  kind: "image" | "html" | "md" | "json" | "file" | "folder"
  size: string
}

export type LibVersion = {
  n: number
  at: string
  /** What changed on the remote since the version before. */
  note: string
  size: string
}

export type LibItem = {
  id: string
  kind: LibKind
  title: string
  /** Provider id; "local" means it has no remote and is never fetched. */
  source: string
  remoteId?: string
  remoteUrl?: string
  /** `namespace:value`. Shared tags are how items relate. */
  tags: string[]
  assets: LibAsset[]
  /** Newest first. */
  versions: LibVersion[]
  /** Version that tasks read; newest unless pinned older. */
  current: number
  /** Card ids that point at this item. */
  usedBy: string[]
}

export const split = (tag: string): [string, string] => {
  const i = tag.indexOf(":")
  return [tag.slice(0, i), tag.slice(i + 1)]
}

/** Every item is a folder: `library/<source>/<id>/`, even when only one file was fetched. */
export const libraryPath = (i: LibItem) =>
  `library/${i.source}/${(i.remoteId ?? i.id).replace(/[^a-z0-9._-]+/gi, "__")}/`
