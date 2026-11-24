import type { Board, Card, CardLink, DocketAsset } from "@workspace/contracts"
import type { Disposable, FileWatcher } from "../ports/file-watcher.ts"
import {
  DOCKET_BOARD_PATH,
  DOCKET_CARDS_GLOB,
  cardIdFromPath,
  cardPath,
  type CardFile,
  type DocketStore,
} from "./store.ts"

export const UNSORTED_COLUMN_ID = "__unsorted__"

export type CardBacklink = {
  from: string
  rel: CardLink["rel"]
}

export type IndexedAsset = {
  path: string
  label?: string
  scope: "owned" | "linked"
  missing: boolean
}

export type IndexedLink = CardLink & {
  dangling: boolean
}

export type CardFace = {
  id: string
  path: string
  hash: string
  title: string
  status: string
  columnId: string
  rank: string
  start?: string
  due?: string
  done?: string | null
  refs: NonNullable<Card["refs"]>
  linkCount: number
  assetCount: number
  missingLinkedAssetCount: number
  warnings: string[]
}

export type CardDetailIndex = CardFace & {
  assets: IndexedAsset[]
  links: IndexedLink[]
  backlinks: CardBacklink[]
}

/** Check linked asset paths without Node I/O in core (DES-038). */
export type PathExists = (path: string) => boolean

export type DocketIndexDeps = {
  store: DocketStore
  watcher: FileWatcher
  exists: PathExists
}

export function createDocketIndex(deps: DocketIndexDeps): DocketIndex {
  return new DocketIndex(deps)
}

export class DocketIndex {
  private readonly entries = new Map<string, CardDetailIndex>()
  private board: Board | null = null
  private watchDisposable: Disposable | undefined

  constructor(private readonly deps: DocketIndexDeps) {}

  start(): void {
    this.rebuild()
    this.watchDisposable = this.deps.watcher.watch(
      [DOCKET_BOARD_PATH, DOCKET_CARDS_GLOB],
      (change) => {
        this.applyChange(change.path)
      }
    )
  }

  dispose(): void {
    this.watchDisposable?.dispose()
    this.watchDisposable = undefined
  }

  rebuild(): void {
    const boardFile = this.deps.store.readBoard()
    this.board = boardFile?.data ?? null
    this.entries.clear()
    for (const card of this.deps.store.listCards()) {
      this.entries.set(card.id, this.buildEntry(card))
    }
    this.applyBacklinks()
  }

  listFaces(): CardFace[] {
    return [...this.entries.values()].map(toFace)
  }

  getCard(id: string): CardDetailIndex | undefined {
    return this.entries.get(id)
  }

  getBoard(): Board | null {
    return this.board
  }

  /** Re-read board.yaml into the index after a hash-checked write. */
  refreshBoard(): void {
    this.applyChange(DOCKET_BOARD_PATH)
  }

  /** Re-read one card.md into the index after a hash-checked write. */
  refreshCard(cardId: string): void {
    this.applyChange(cardPath(cardId))
  }

  private applyChange(path: string): void {
    const norm = path.replace(/\\/g, "/").replace(/^\//, "")
    if (norm === DOCKET_BOARD_PATH) {
      const boardFile = this.deps.store.readBoard()
      this.board = boardFile?.data ?? null
      for (const [id, entry] of this.entries) {
        this.entries.set(id, {
          ...entry,
          columnId: columnForStatus(entry.status, this.board),
        })
      }
      return
    }
    const cardId = cardIdFromPath(norm)
    if (!cardId) return

    const card = this.deps.store.readCard(cardId)
    if (card) {
      this.entries.set(cardId, this.buildEntry(card))
    } else {
      this.entries.delete(cardId)
    }
    this.applyBacklinks()
  }

  private buildEntry(card: CardFile): CardDetailIndex {
    const data = card.data
    const status = data?.status ?? "unknown"
    const assets = (data?.assets ?? []).map((asset) =>
      indexAsset(asset, this.deps.exists)
    )
    const links: IndexedLink[] = (data?.links ?? []).map((link) => ({
      ...link,
      dangling: false,
    }))

    return {
      id: card.id,
      path: card.path,
      hash: card.hash,
      title: data?.title ?? card.id,
      status,
      columnId: columnForStatus(status, this.board),
      rank: data?.rank ?? "",
      start: data?.start,
      due: data?.due,
      done: data?.done,
      refs: data?.refs ?? [],
      linkCount: links.length,
      assetCount: assets.length,
      missingLinkedAssetCount: assets.filter((a) => a.missing).length,
      warnings: card.warnings,
      assets,
      links,
      backlinks: [],
    }
  }

  private applyBacklinks(): void {
    const known = new Set(this.entries.keys())
    const backlinks = new Map<string, CardBacklink[]>()

    for (const [from, entry] of this.entries) {
      const nextLinks: IndexedLink[] = entry.links.map((link) => ({
        ...link,
        dangling: !known.has(link.to),
      }))
      this.entries.set(from, { ...entry, links: nextLinks, backlinks: [] })
      for (const link of nextLinks) {
        if (link.dangling) continue
        const list = backlinks.get(link.to) ?? []
        list.push({ from, rel: link.rel })
        backlinks.set(link.to, list)
      }
    }

    for (const [id, bl] of backlinks) {
      const entry = this.entries.get(id)
      if (entry) this.entries.set(id, { ...entry, backlinks: bl })
    }
  }
}

function columnForStatus(status: string, board: Board | null): string {
  const ids = board?.columns.map((c) => c.id) ?? []
  return ids.includes(status) ? status : UNSORTED_COLUMN_ID
}

function indexAsset(asset: DocketAsset, exists: PathExists): IndexedAsset {
  const scope = asset.scope ?? (asset.path.startsWith("/") ? "linked" : "owned")
  const missing = scope === "linked" ? !exists(asset.path) : false
  return {
    path: asset.path,
    label: asset.label,
    scope,
    missing,
  }
}

function toFace(entry: CardDetailIndex): CardFace {
  return {
    id: entry.id,
    path: entry.path,
    hash: entry.hash,
    title: entry.title,
    status: entry.status,
    columnId: entry.columnId,
    rank: entry.rank,
    start: entry.start,
    due: entry.due,
    done: entry.done,
    refs: entry.refs,
    linkCount: entry.linkCount,
    assetCount: entry.assetCount,
    missingLinkedAssetCount: entry.missingLinkedAssetCount,
    warnings: entry.warnings,
  }
}
