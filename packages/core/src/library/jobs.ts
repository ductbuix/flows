import { LibItemId, type LibItem, type LibVersion } from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { engineError } from "../kernel/engine-error.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { LibraryFetcher } from "./fetch.ts"
import {
  contentHashOf,
  listVersionMetas,
  newestVersionN,
  nextCurrent,
  readItemDisk,
  readVersionFiles,
  writeItemDisk,
  writeVersion,
} from "./versions.ts"

export type LibraryJobDeps = {
  docs: DocumentStore
  bus: UpdateBus
  clock: Clock
  fetcher: LibraryFetcher
  get: (id: string) => LibItem | null
}

/** Pull remote content into a new version (or finish unchanged). */
export async function runPullJob(
  deps: LibraryJobDeps,
  jobId: string,
  itemId: ReturnType<typeof LibItemId.parse>,
  signal: AbortSignal
): Promise<void> {
  deps.bus.publish("library/update", {
    kind: "job_progress",
    jobId,
    itemId,
    message: "Fetching",
    fraction: 0.1,
  })
  try {
    const disk = readItemDisk(deps.docs, itemId)
    if (!disk)
      throw engineError("not_found", `Library item not found: ${itemId}`)
    const fetched = await deps.fetcher.fetch(disk, signal)
    const hash = contentHashOf(fetched.files)
    const metas = listVersionMetas(deps.docs, itemId)
    const previousNewest = newestVersionN(metas)
    const latest = metas.find((m) => m.n === previousNewest)
    if (latest && latest.contentHash === hash) {
      deps.bus.publish("library/update", {
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
    const meta = {
      n,
      at: new Date(deps.clock.now()).toISOString(),
      note:
        fetched.note ?? (previousNewest === 0 ? "First fetch" : "Updated"),
      contentHash: hash,
    }
    writeVersion(deps.docs, itemId, meta, fetched.files)
    writeItemDisk(deps.docs, {
      ...disk,
      current: nextCurrent(disk.current, previousNewest, n),
    })
    publishOk(deps, jobId, itemId, meta)
  } catch (err) {
    finishFailed(deps, jobId, itemId, err, "Pull failed")
  }
}

/** Push the current version's files to the remote; records a local version. */
export async function runPushJob(
  deps: LibraryJobDeps,
  jobId: string,
  itemId: ReturnType<typeof LibItemId.parse>,
  signal: AbortSignal
): Promise<void> {
  deps.bus.publish("library/update", {
    kind: "job_progress",
    jobId,
    itemId,
    message: "Pushing",
    fraction: 0.1,
  })
  try {
    const disk = readItemDisk(deps.docs, itemId)
    if (!disk)
      throw engineError("not_found", `Library item not found: ${itemId}`)
    const files = readVersionFiles(deps.docs, itemId, disk.current)
    const pushed = await deps.fetcher.push(disk, files, signal)
    const metas = listVersionMetas(deps.docs, itemId)
    const previousNewest = newestVersionN(metas)
    const n = previousNewest + 1
    const meta = {
      n,
      at: new Date(deps.clock.now()).toISOString(),
      note: pushed.note ?? "Pushed local changes to the remote",
      contentHash: contentHashOf(files),
    }
    writeVersion(deps.docs, itemId, meta, files)
    writeItemDisk(deps.docs, {
      ...disk,
      current: nextCurrent(disk.current, previousNewest, n),
    })
    publishOk(deps, jobId, itemId, meta)
  } catch (err) {
    finishFailed(deps, jobId, itemId, err, "Push failed")
  }
}

function publishOk(
  deps: LibraryJobDeps,
  jobId: string,
  itemId: ReturnType<typeof LibItemId.parse>,
  meta: { n: number; at: string; note: string; contentHash: string }
): void {
  const item = deps.get(itemId)
  if (!item) throw engineError("not_found", `Library item not found: ${itemId}`)
  deps.bus.publish("library/update", { kind: "item_changed", item })
  deps.bus.publish("library/update", {
    kind: "job_finished",
    jobId,
    itemId,
    ok: true,
    unchanged: false,
    version: metaToVersion(meta),
  })
}

function finishFailed(
  deps: LibraryJobDeps,
  jobId: string,
  itemId: ReturnType<typeof LibItemId.parse>,
  err: unknown,
  fallback: string
): void {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : fallback
  deps.bus.publish("library/update", {
    kind: "job_finished",
    jobId,
    itemId,
    ok: false,
    error: message,
  })
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
