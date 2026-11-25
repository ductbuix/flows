# core: docket (board, cards, ranks, FCP)

Part of the [`@workspace/core` spec](core.md). Covers `src/docket/`.

The docket is a kanban board stored as text: `docket/board.yaml` and one
`docket/cards/<cardId>/card.md` per card (YAML frontmatter + markdown body).
Owned card assets live in `docket/cards/<cardId>/assets/<name>`. Parsing,
patching and schemas come from contracts (`splitCardMd`, `patchCardMd`,
`patchYamlMapping`, `yamlMappingToJs`, `tolerantParseCard`,
`tolerantParseBoard`; types `Board`, `Card`, `CardLink`, `DocketAsset`,
`DocketRef`, `WireCardFace`). Writes keep YAML comments and unknown keys.

## Files

| File               | Purpose                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `store.ts`         | `DocketStore`: read/write board and cards via `DocumentStore`; path helpers                |
| `index.ts`         | `DocketIndex`: in-memory faces, columns, links/backlinks, asset presence; watcher-driven   |
| `rank.ts`          | base-62 fractional ranks (`rankBetween`, `compareRank`)                                    |
| `move.ts`          | `rankAtColumnEnd`, `computeMoveRank`, `doneForColumnMove`                                  |
| `wire-face.ts`     | `toWireFace(CardFace)`                                                                     |
| `read.ts`          | `createDocketReadBindings` (`get_board`, `list_cards`, `get_card`)                         |
| `write.ts`         | `createDocketWriteBindings` (create/update/move/delete card, add/remove asset, save board) |
| `write-helpers.ts` | `DocketWriteDeps`, `publishCardChanged`, `loadCurrentCard`, `currentBoardPayload`          |
| `move-fcp.ts`      | `bindDocketMoveCard`                                                                       |
| `assets-fcp.ts`    | `bindDocketAddAsset`, `bindDocketRemoveAsset`                                              |
| `run-ref.ts`       | attach `flows-run` refs on `run.finished`                                                  |

Root exports from this area: `rankBetween`; from `index.ts`
`createDocketIndex`, `DocketIndex`, `UNSORTED_COLUMN_ID`, `CardBacklink`,
`CardDetailIndex`, `CardFace`, `DocketIndexDeps`, `IndexedAsset`,
`IndexedLink`, `PathExists`; from `run-ref.ts` `FLOWS_RUN_SYSTEM`,
`applyRunFinishedRef`, `attachRunFinishedRef`, `flowsRunRefLabel`,
`RunRefDeps`; from `store.ts` `cardIdFromPath`, `cardPath`,
`createDocketStore`, `DOCKET_BOARD_PATH`, `DOCKET_CARDS_GLOB`, `DocketStore`,
`ownedAssetRelPath`, `ownedAssetStorePath`, `storeRelPath`, `BoardFile`,
`CardFile`, `DocketStoreDeps`; `createDocketReadBindings`,
`DocketReadBindings`, `DocketReadDeps`; `createDocketWriteBindings`,
`DocketWriteBindings`, `DocketWriteDeps`.

## Store (`store.ts`)

```ts
const DOCKET_BOARD_PATH = "docket/board.yaml"
const DOCKET_CARDS_GLOB = "docket/cards/*/card.md"
cardPath(id) → `docket/cards/${id}/card.md`
ownedAssetRelPath(name) → `assets/${name}`
ownedAssetStorePath(id, name) → `docket/cards/${id}/assets/${name}`
storeRelPath(path)   // \ → /, strip one leading /
cardIdFromPath(path) // regex ^docket/cards/([^/]+)/card\.md$ on storeRelPath
type CardFile = { id; path; text; hash; data: Card | null; warnings: string[] }
type BoardFile = { path; text; hash; data: Board | null; warnings: string[] }
class DocketStore {
  constructor(deps: { docs: DocumentStore; clock: Clock })
  nowIso(): string
  readBoard(): BoardFile | null
  writeBoardRaw(text, baseHash?): DocumentWriteResult
  saveBoard(board: Board, baseHash?): DocumentWriteResult
  listCards(): CardFile[]                 // sorted by id (localeCompare)
  readCard(id): CardFile | null
  writeCardRaw(id, text, baseHash?): DocumentWriteResult
  deleteCard(id): DocumentRemoveResult
  writeOwnedAsset(id, name, text): DocumentWriteResult   // UTF-8 text
  saveCard(id, patch: Record<string, unknown>, options?: { body?: string; baseHash?: string }): DocumentWriteResult
}
createDocketStore(deps)
```

- Card parsing: no valid frontmatter fence → `data: null`, warning
  `card.md: missing or invalid frontmatter fence`; YAML error → `data: null`,
  warning `frontmatter: <error>`; otherwise `tolerantParseCard` (data +
  warnings; half-valid cards yield warnings instead of throwing). Broken
  cards still list with their folder id and raw text.
- Board parsing: YAML error → `data: null`, warning `board.yaml: <error>`;
  otherwise `tolerantParseBoard`.
- `saveBoard(board, baseHash)`: `baseHash === ""` means "create": if a board
  file exists → conflict result with the disk text/hash; else no lock. Base
  text = disk text or `"version: 1\ncolumns: []\n"`; text =
  `patchYamlMapping(base, {version, columns, face: board.face ?? []})`.
- `saveCard(id, patch, {body?, baseHash?})`: `updated = now`; base = disk
  text, or the minimal card
  `---\nid: <id>\ntitle: Untitled\nstatus: todo\ncreated: <now>\nupdated: <now>\n---\n\n`;
  text = `patchCardMd(base, {...patch, updated}, body)`; write with
  `baseHash ?? disk hash` (so an unlocked save still detects races).

## Index (`index.ts`)

```ts
const UNSORTED_COLUMN_ID = "__unsorted__"
type CardBacklink = { from: string; rel: CardLink["rel"] }
type IndexedAsset = {
  path
  label?
  scope: "owned" | "linked"
  missing: boolean
}
type IndexedLink = CardLink & { dangling: boolean }
type CardFace = {
  id
  path
  hash
  title
  status
  columnId
  rank
  start?
  due?
  done?: string | null
  refs
  linkCount
  assetCount
  missingLinkedAssetCount
  warnings: string[]
}
type CardDetailIndex = CardFace & {
  assets: IndexedAsset[]
  links: IndexedLink[]
  backlinks: CardBacklink[]
}
type PathExists = (path: string) => boolean
type DocketIndexDeps = {
  store: DocketStore
  watcher: FileWatcher
  exists: PathExists
}
class DocketIndex {
  start()
  dispose()
  rebuild()
  listFaces(): CardFace[]
  getCard(id): CardDetailIndex | undefined
  getBoard(): Board | null
  refreshBoard()
  refreshCard(id)
}
createDocketIndex(deps)
```

- `start()`: `rebuild()` then watch `[DOCKET_BOARD_PATH, DOCKET_CARDS_GLOB]`
  and `applyChange(path)` on each change (hand edits on disk are picked up).
- Entry from a card: `status = data.status ?? "unknown"`, `title =
data.title ?? id`, `rank = data.rank ?? ""`, `refs = data.refs ?? []`,
  `columnId` = status if it is a board column id else `__unsorted__`.
  Assets: `scope = asset.scope ?? (path starts with "/" ? "linked" :
"owned")`; `missing = scope === "linked" && !exists(path)` (owned assets
  are never checked).
- Backlinks recomputed over all entries after every card change: a link is
  `dangling` when its `to` card is not indexed; non-dangling links add
  `{from, rel}` to the target's backlinks.
- Board change: re-read board and recompute every entry's `columnId`.
  Card change: re-read; missing file → delete entry.
- `listFaces()` returns faces (without assets/links/backlinks) in map order.

## Ranks (`rank.ts`, `move.ts`)

Digits `RANK_DIGITS = "0-9A-Za-z"` (62, code-unit ordered). `compareRank`
compares rank strings by code unit, then id. `rankBetween(a?, b?)`:

- none → `"V"` (middle digit, index 31).
- both: requires `a < b` (`Error("rankBetween: lower bound must be less than
upper bound")`), then `midpoint(a, b)`.
- only `b` → `midpoint("", b)`; only `a` → `midpoint(a, null)`.

`midpoint(a, b)`: keys must not end with `"0"` (`Error("rank keys must not
end with the smallest digit")`); invalid chars throw `invalid rank
character: "<c>"`. Strip the common prefix (treating a missing `a` digit as
`0`) and recurse. Then with `da` = index of `a[0]` (0 if empty) and `db` =
index of `b[0]` (62 if `b` null): if `db - da > 1` return digit
`round((da+db)/2)`; else if `b` has more than one char return `b[0]`; else
return `a[0]` digit + `midpoint(a.slice(1), null)`. (Standard fractional
indexing; 10 000 random inserts stay ordered.)

`rankAtColumnEnd(faces, status)`: column = faces with that status sorted by
`compareRank`; empty → `rankBetween()`; else try `rankBetween(last.rank ||
undefined, undefined)`, then `rankBetween(last.rank)`, then `rankBetween()`.

`computeMoveRank(faces, cardId, status, beforeId?)`: column excludes the
moved card. If `beforeId` is found at `insertAt`: when the previous card has
the same rank as the anchor and `prev.id < cardId < anchor.id`, reuse that
rank; otherwise try bounds in order — `(prev, anchor)`, `(-, anchor)`, each
earlier rank `< anchor` as lower bound, `(anchor, each later rank > anchor)`,
`(prev, -)`, `()` — accepting the first rank that sorts (with `cardId` as
tie-break) strictly after `prev` and before `anchor`; fallback
`rankBetween()`. Without a found anchor → end of column. Handles columns
where every card lacks a rank and uppercase-before-lowercase ranks.

`doneForColumnMove(board, from, to, now)`: same column → `undefined`;
entering a column with `done: true` → `now`; leaving a done column →
`null` (clears); otherwise `undefined`.

## FCP bindings

`DocketReadDeps = { index; store }`; `DocketWriteDeps = { index; store; bus:
UpdateBus; blobs: BlobStore }`. Notifications go to `docket/update` with
`kind` `card_changed {card: WireCardFace}`, `card_removed {cardId}`,
`board_changed {hash, board}`. `publishCardChanged` publishes only when the
card is indexed. `loadCurrentCard` = wire face + `body` (from
`splitCardMd`, `""` if none) + `fields` + `assets`, `links`, `backlinks`
(not found → `not_found "Card not found: <id>"`). Every conflict error is
`conflict "Stale baseHash"` with `data {current: <loadCurrentCard or
currentBoardPayload>}`.

| Method                | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docket/get_board`    | `{board: index board ?? file data ?? null, hash: file hash ?? "", warnings: file warnings ?? []}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docket/list_cards`   | faces sorted by id; `cursor` = id (unknown → start at 0); `limit` default **100**; `next` = last id when more; no bodies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docket/get_card`     | not indexed → `not_found "Card not found: <id>"`; `loadCurrentCard` shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `docket/create_card`  | existing file → `invalid_params "Card already exists: <id>"`; `status = params.status ?? first board column ?? "todo"`; `rank = rankAtColumnEnd`; `saveCard(id, {id, title, status, created: now, rank, refs}, {body: body ?? ""})`; failed write → `internal "Failed to create card"`; refresh + `card_changed`; returns `{hash, rank}`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docket/update_card`  | not indexed → `not_found`; `patch` minus `body` is frontmatter; `start: null` / `due: null` become `undefined` (cleared); save with `baseHash`; conflict → `conflict`; else `internal "Failed to update card"`; refresh + `card_changed`; `{hash}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `docket/move_card`    | not found → `not_found`; `beforeId === id` → `invalid_params "beforeId cannot be the moved card"`; `beforeId` card missing → `not_found`; anchor in another status → `invalid_params "beforeId is not in the target column"`; patch `{status, rank: computeMoveRank, done?}`; save with `baseHash`; conflict / `internal "Failed to move card"`; refresh + `card_changed`; `{hash, rank}`                                                                                                                                                                                                                                                                                                                                                                                                      |
| `docket/delete_card`  | not indexed or remove fails → `not_found`; refresh; publish `card_removed`; `{}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `docket/add_asset`    | not found → `not_found`. `scope: "owned"`: name = basename of `name` (`\`→`/`; empty/`.`/`..` → `invalid_params "Invalid asset name: <name>"`); rel `assets/<name>`; duplicate path → `invalid_params "Asset already on card: <path>"`; read blob `blobId` as UTF-8 (missing → `not_found "Blob not found: <id>"`); write the owned file (fail → `internal "Failed to write <rel>"`); append `{path: rel, label?}`. Linked: path must start with `/` (`invalid_params "Linked asset path must be absolute"`), duplicate check, append `{path, scope: "linked", label?}`. Asset list rewritten with `scope` only for linked. Conflict / `internal "Failed to add asset"`. Returns `{hash, asset: <IndexedAsset>}` (`internal "Asset missing after add"` if not indexed)                         |
| `docket/remove_asset` | not found → `not_found`; path not on card → `not_found "Asset not on card: <path>"`; rewrite assets without it (never deletes the file); conflict / `internal "Failed to remove asset"`; `{hash}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docket/save_board`   | removed columns = current column ids not in the new board; affected = faces whose `status` is a removed id. Affected without `migrateStatus` → `invalid_params "Removing columns with cards requires migrateStatus"` with `data {affectedCards: WireCardFace[]}`. With `migrateStatus`: must be a column of the new board (`invalid_params "migrateStatus is not a column: <s>"`); each affected card saved with `{status}` under its face hash (conflict → `conflict "Card changed while migrating columns"` with current card) and published. Then `saveBoard(board, baseHash)` (conflict → `conflict` with `currentBoardPayload`; else `internal "Failed to save board"`); refresh; publish `board_changed` when a board is indexed; returns `{hash, migratedCardIds?}` (omitted when none) |

Two concurrent moves of different cards both succeed (each locks only its
own card file).

## Run refs (`run-ref.ts`)

`FLOWS_RUN_SYSTEM = "flows-run"`; `flowsRunRefLabel(workflowId, status)` →
`"<workflowId> · <status>"`. `attachRunFinishedRef(events: EventBus, deps:
{store, index, bus})` subscribes to `run.finished` and calls
`applyRunFinishedRef`: no `cardId`, missing card or unparsable card →
no-op; upsert ref `{system: "flows-run", id: runId, label}` (merge into an
existing ref with same system+id, else append); `saveCard(cardId, {refs},
{baseHash: card.hash})`; on success refresh + `card_changed` (conflicts are
ignored silently).
