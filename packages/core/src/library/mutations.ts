import {
  LibItemId,
  type LibItem,
  type LibItemDisk,
  type ProviderIcon,
} from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { engineError } from "../kernel/engine-error.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import {
  contentHashOf,
  readItemDisk,
  writeItemDisk,
  writeVersion,
} from "./versions.ts"

export type MutationDeps = {
  docs: DocumentStore
  clock: Clock
  get: (id: string) => LibItem | null
  publishChanged: (id: string) => LibItem
}

/** Create a linked item (no version yet). Client should call pull. */
export function addRemoteItem(
  deps: MutationDeps,
  input: {
    id: string
    kind: ProviderIcon
    title: string
    source: string
    remoteId: string
    remoteUrl: string
    tags: string[]
  }
): LibItem {
  const id = LibItemId.parse(input.id)
  if (deps.get(id)) {
    throw engineError("conflict", `Library item already exists: ${id}`)
  }
  writeItemDisk(deps.docs, {
    id,
    kind: input.kind,
    title: input.title,
    source: input.source,
    remoteId: input.remoteId,
    remoteUrl: input.remoteUrl,
    tags: [...input.tags],
    current: 1,
  })
  return deps.publishChanged(id)
}

/** Create a local-only item with version 1 from the given files. */
export function addLocalItem(
  deps: MutationDeps,
  input: {
    id: string
    kind: ProviderIcon
    title: string
    tags: string[]
    files: Readonly<Record<string, string>>
  }
): LibItem {
  const id = LibItemId.parse(input.id)
  if (deps.get(id)) {
    throw engineError("conflict", `Library item already exists: ${id}`)
  }
  const files =
    Object.keys(input.files).length > 0 ? input.files : { "README.md": "" }
  writeItemDisk(deps.docs, {
    id,
    kind: input.kind,
    title: input.title,
    source: "local",
    tags: [...input.tags],
    current: 1,
  })
  writeVersion(
    deps.docs,
    id,
    {
      n: 1,
      at: new Date(deps.clock.now()).toISOString(),
      note: "Added from disk",
      contentHash: contentHashOf(files),
    },
    files
  )
  return deps.publishChanged(id)
}

/** Keep local versions; drop the remote link. */
export function unlinkItem(deps: MutationDeps, id: string): LibItem {
  const existing = deps.get(id)
  if (!existing) throw engineError("not_found", `Library item not found: ${id}`)
  const disk = readItemDisk(deps.docs, existing.id)
  if (!disk) throw engineError("not_found", `Library item not found: ${id}`)
  if (disk.source === "local") {
    throw engineError("unsupported", "Item is not linked to a remote")
  }
  const next: LibItemDisk = {
    id: disk.id,
    kind: disk.kind,
    title: disk.title,
    source: "local",
    tags: disk.tags,
    current: disk.current,
  }
  writeItemDisk(deps.docs, next)
  return deps.publishChanged(id)
}
