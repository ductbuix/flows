import { LibItemId, type LibItem, type LibVersion } from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { engineError } from "../kernel/engine-error.ts"
import type { Ids } from "../kernel/ids.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { LibraryFetcher } from "./fetch.ts"
import {
  contentHashOf,
  listItemIds,
  listVersionMetas,
  newestVersionN,
  nextCurrent,
  readItemDisk,
  toLibItem,
  writeItemDisk,
  writeVersion,
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

  list(): LibItem[] {
    return listItemIds(this.deps.docs)
      .map((id) => this.get(id))
      .filter((item): item is LibItem => item !== null)
  }

  get(id: string): LibItem | null {
    const disk = readItemDisk(this.deps.docs, id)
    if (!disk) return null
    const versions = listVersionMetas(this.deps.docs, id).map(metaToVersion)
    return toLibItem(disk, versions)
  }

  /** Pin `current` to an existing version (BL-173 will expose over FCP). */
  pinVersion(id: string, n: number): LibItem {
    const item = this.require(id)
    if (!item.versions.some((v) => v.n === n)) {
      throw engineError("not_found", `Version not found: v${n}`)
    }
    const next = { ...item, current: n }
    writeItemDisk(this.deps.docs, next)
    const updated = this.require(id)
    this.deps.bus.publish("library/update", {
      kind: "item_changed",
      item: updated,
    })
    return updated
  }

  /** Starts a pull job; progress and finish arrive on `library/update`. */
  pull(id: string, signal: AbortSignal): { jobId: string } {
    this.require(id)
    const jobId = this.deps.ids.id("job")
    const itemId = LibItemId.parse(id)
    const run = this.runPull(jobId, itemId, signal)
    this.pending.add(run)
    void run.finally(() => this.pending.delete(run))
    return { jobId }
  }

  /** Wait for in-flight pull jobs (tests). */
  async flush(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending])
    }
  }

  private require(id: string): LibItem {
    const item = this.get(id)
    if (!item) throw engineError("not_found", `Library item not found: ${id}`)
    return item
  }

  private async runPull(
    jobId: string,
    itemId: ReturnType<typeof LibItemId.parse>,
    signal: AbortSignal
  ): Promise<void> {
    this.deps.bus.publish("library/update", {
      kind: "job_progress",
      jobId,
      itemId,
      message: "Fetching",
      fraction: 0.1,
    })
    try {
      const disk = readItemDisk(this.deps.docs, itemId)
      if (!disk)
        throw engineError("not_found", `Library item not found: ${itemId}`)
      const fetched = await this.deps.fetcher.fetch(disk, signal)
      const hash = contentHashOf(fetched.files)
      const metas = listVersionMetas(this.deps.docs, itemId)
      const previousNewest = newestVersionN(metas)
      const latest = metas.find((m) => m.n === previousNewest)
      if (latest && latest.contentHash === hash) {
        this.deps.bus.publish("library/update", {
          kind: "job_finished",
          jobId,
          itemId,
          ok: true,
          unchanged: true,
          version: metaToVersion(latest),
        })
        return
      }
      const n = previousNewest + 1
      const at = new Date(this.deps.clock.now()).toISOString()
      const meta = {
        n,
        at,
        note:
          fetched.note ?? (previousNewest === 0 ? "First fetch" : "Updated"),
        contentHash: hash,
      }
      writeVersion(this.deps.docs, itemId, meta, fetched.files)
      const current = nextCurrent(disk.current, previousNewest, n)
      writeItemDisk(this.deps.docs, { ...disk, current })
      const item = this.require(itemId)
      this.deps.bus.publish("library/update", {
        kind: "item_changed",
        item,
      })
      this.deps.bus.publish("library/update", {
        kind: "job_finished",
        jobId,
        itemId,
        ok: true,
        unchanged: false,
        version: metaToVersion(meta),
      })
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Pull failed"
      this.deps.bus.publish("library/update", {
        kind: "job_finished",
        jobId,
        itemId,
        ok: false,
        error: message,
      })
    }
  }
}

function metaToVersion(meta: {
  n: number
  at: string
  note: string
  contentHash: string
}): LibVersion {
  return {
    n: meta.n,
    at: meta.at,
    note: meta.note,
    contentHash: meta.contentHash,
  }
}
