import {
  LibItemId,
  type LibItem,
  type ProviderIcon,
} from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { engineError } from "../kernel/engine-error.ts"
import type { Ids } from "../kernel/ids.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { LibraryFetcher } from "./fetch.ts"
import { runPullJob, runPushJob } from "./jobs.ts"
import { addLocalItem, addRemoteItem, unlinkItem } from "./mutations.ts"
import { cardUsersOfItem } from "./users.ts"
import {
  listItemIds,
  listVersionMetas,
  readItemDisk,
  removeItemTree,
  toDisk,
  toLibItem,
  writeItemDisk,
} from "./versions.ts"

export type LibraryServiceDeps = {
  docs: DocumentStore
  bus: UpdateBus
  ids: Ids
  clock: Clock
  fetcher: LibraryFetcher
}

export function createLibraryService(deps: LibraryServiceDeps): LibraryService {
  return new LibraryService(deps)
}

export class LibraryService {
  private readonly pending = new Set<Promise<void>>()

  constructor(private readonly deps: LibraryServiceDeps) {}

  list(tag?: string): LibItem[] {
    const items = listItemIds(this.deps.docs)
      .map((id) => this.get(id))
      .filter((item): item is LibItem => item !== null)
    if (tag === undefined) return items
    return items.filter((item) => item.tags.includes(tag))
  }

  get(id: string): LibItem | null {
    const disk = readItemDisk(this.deps.docs, id)
    if (!disk) return null
    return toLibItem(
      disk,
      listVersionMetas(this.deps.docs, id).map(metaToVersion)
    )
  }

  pinVersion(id: string, n: number): LibItem {
    const item = this.require(id)
    if (!item.versions.some((v) => v.n === n)) {
      throw engineError("not_found", `Version not found: v${n}`)
    }
    writeItemDisk(this.deps.docs, { ...toDisk(item), current: n })
    return this.publishChanged(id)
  }

  setTags(id: string, tags: string[]): LibItem {
    this.require(id)
    const disk = readItemDisk(this.deps.docs, id)!
    writeItemDisk(this.deps.docs, { ...disk, tags: [...tags] })
    return this.publishChanged(id)
  }

  addRemote(input: {
    id: string
    kind: ProviderIcon
    title: string
    source: string
    remoteId: string
    remoteUrl: string
    tags: string[]
  }): LibItem {
    return addRemoteItem(this.mutationDeps(), input)
  }

  addLocal(input: {
    id: string
    kind: ProviderIcon
    title: string
    tags: string[]
    files: Readonly<Record<string, string>>
  }): LibItem {
    return addLocalItem(this.mutationDeps(), input)
  }

  unlink(id: string): LibItem {
    return unlinkItem(this.mutationDeps(), id)
  }

  remove(id: string): void {
    this.require(id)
    const users = cardUsersOfItem(this.deps.docs, id)
    if (users.length > 0) {
      throw engineError(
        "busy",
        `Library item is used by cards: ${users.join(", ")}`,
        { users }
      )
    }
    const itemId = LibItemId.parse(id)
    removeItemTree(this.deps.docs, id)
    this.deps.bus.publish("library/update", {
      kind: "item_removed",
      id: itemId,
    })
  }

  pull(id: string, signal: AbortSignal): { jobId: string } {
    return this.startJob(id, signal, runPullJob)
  }

  push(id: string, signal: AbortSignal): { jobId: string } {
    return this.startJob(id, signal, runPushJob)
  }

  async flush(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending])
    }
  }

  private mutationDeps() {
    return {
      docs: this.deps.docs,
      clock: this.deps.clock,
      get: (id: string) => this.get(id),
      publishChanged: (id: string) => this.publishChanged(id),
    }
  }

  private startJob(
    id: string,
    signal: AbortSignal,
    run: typeof runPullJob
  ): { jobId: string } {
    this.require(id)
    const jobId = this.deps.ids.id("job")
    const itemId = LibItemId.parse(id)
    const pending = run(
      {
        docs: this.deps.docs,
        bus: this.deps.bus,
        clock: this.deps.clock,
        fetcher: this.deps.fetcher,
        get: (itemId: string) => this.get(itemId),
      },
      jobId,
      itemId,
      signal
    )
    this.pending.add(pending)
    void pending.finally(() => this.pending.delete(pending))
    return { jobId }
  }

  private publishChanged(id: string): LibItem {
    const updated = this.require(id)
    this.deps.bus.publish("library/update", {
      kind: "item_changed",
      item: updated,
    })
    return updated
  }

  private require(id: string): LibItem {
    const item = this.get(id)
    if (!item) throw engineError("not_found", `Library item not found: ${id}`)
    return item
  }
}

function metaToVersion(meta: {
  n: number
  at: string
  note: string
  contentHash: string
}): LibItem["versions"][number] {
  return {
    n: meta.n,
    at: meta.at,
    note: meta.note,
    contentHash: meta.contentHash,
  }
}
