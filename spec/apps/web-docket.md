# apps/web — Docket (`/docket`)

Part of the [web spec](web.md). Kanban board of cards (work items). Cards
wrap tickets (refs), files (assets), links to other cards and runs of
workflows. Files: `src/pages/docket/*` (24 source files).

Shared parts used here: `Page`, `PageTitle` ([web.md § page frame](web.md#page-frame)),
`FlowsClientGate`, `ConfirmDialog`, `StatusPill`, `RelativeTime`,
`RunSheet`, `statusOf`, `startRun`, `DiskPickerBoth`, `uploadBlob`,
`errorMessage` / `isConflictError` (all in [web.md](web.md)).

## File map

| File                     | Exports                                                           | Role                                             |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| `DocketPage.tsx`         | `DocketPage`                                                      | Route element; gate + board page                 |
| `DocketStates.tsx`       | `DocketLoading`, `DocketLoadError`, `DocketNoBoard`               | Whole-page states                                |
| `DocketDialogs.tsx`      | `DocketDialogs`                                                   | Columns dialog, new-card dialog, card panel      |
| `BoardLanes.tsx`         | `BoardLanes`                                                      | Horizontal lanes with native HTML5 drag and drop |
| `ColumnHeader.tsx`       | `ColumnHeader`, `LANE_BG`                                         | Lane header (icon, label, count)                 |
| `CardTile.tsx`           | `CardTile`                                                        | One card face on a lane                          |
| `board-actions.ts`       | `rankCards`, `ensureBoard`, `moveCard`                            | FCP helpers                                      |
| `column-tone.ts`         | `Tone`, `UiColumn`, `toUiColumns`, `DEFAULT_BOARD_COLUMNS`        | Column → tone mapping                            |
| `format-date.ts`         | `formatDate`                                                      | `"2026-11-28"` → `"Nov 28, 2026"`                |
| `ref-from-link.ts`       | `refFromLink`                                                     | URL → `DocketRef`                                |
| `ColumnsDialog.tsx`      | `ColumnsDialog`                                                   | Edit columns                                     |
| `ColumnEditorRow.tsx`    | `ColumnEditorRow`                                                 | One row in the columns editor                    |
| `NewCardDialog.tsx`      | `NewCardDialog`, `NewCardInput`                                   | Create a card                                    |
| `CardPanel.tsx`          | `CardPanel`                                                       | Right Sheet wrapper                              |
| `CardPanelHeader.tsx`    | `CardPanelHeader`                                                 | Sheet header, title edit, delete menu, alerts    |
| `CardPanelBody.tsx`      | `CardPanelBody`                                                   | Loads the card, two-column body                  |
| `InlineText.tsx`         | `InlineText`                                                      | Click-to-edit text / textarea / date             |
| `SectionParts.tsx`       | `Section`, `EmptyLine`, `Row`, `ListRow`, `RemoveButton`, `Adder` | Panel building blocks                            |
| `PropertiesSection.tsx`  | `PropertiesSection`, `PropertyPatch`                              | Status, start, due, custom fields                |
| `RefsSection.tsx`        | `RefsSection`                                                     | External refs list + add                         |
| `RefDataSection.tsx`     | `RefDataSection`                                                  | Read-only connector data per ref                 |
| `LinksSection.tsx`       | `LinksSection`, `CardOption`, `CardBacklink`                      | Card-to-card links + backlinks                   |
| `AssetsSection.tsx`      | `AssetsSection`                                                   | Owned + linked files                             |
| `AssetOpenMenu.tsx`      | `AssetOpenMenu`                                                   | "Open in" dropdown (Files, Finder, Cursor)       |
| `AddAssetDiskDialog.tsx` | `AddAssetDiskDialog`                                              | Upload files from disk as owned assets           |
| `CardRunsSection.tsx`    | `CardRunsSection`                                                 | Runs for this card + run sheet                   |
| `RunWorkflowDialog.tsx`  | `RunWorkflowDialog`                                               | Start a workflow run for the card                |

## FCP calls (summary)

| Method                                             | Params                                                                                                                                 | Where                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `docket/get_board` (query, topic `docket`)         | `{}` → `{ board: Board \| null, hash }`                                                                                                | DocketPage, CardPanelBody            |
| `docket/list_cards` (query, topic `docket`)        | `{}` → `{ items: WireCardFace[] }`                                                                                                     | DocketPage, CardPanelBody            |
| `docket/get_card` (query, topic `docket`)          | `{ id }` → card detail with `hash`, `refs`, `links`, `backlinks`, `assets`, `fields`, `body`, `start`, `due`, `status`, `title`, `id`  | CardPanelBody                        |
| `docket/save_board`                                | `{ baseHash, board, migrateStatus? }` → `{ hash }`                                                                                     | ensureBoard, DocketDialogs.saveBoard |
| `docket/move_card`                                 | `{ id, status, beforeId: string \| null, baseHash: face.hash }`                                                                        | moveCard                             |
| `docket/create_card`                               | `{ id, title, status, body?, refs? }`                                                                                                  | DocketDialogs.createCard             |
| `docket/update_card`                               | `{ id, baseHash, patch: CardPatch }`                                                                                                   | CardPanelBody.patch                  |
| `docket/delete_card`                               | `{ id }`                                                                                                                               | CardPanelBody confirm                |
| `docket/add_asset`                                 | linked: `{ id, scope: "linked", path, label, baseHash }`; owned: `{ id, scope: "owned", blobId, name, label?, baseHash }` → `{ hash }` | AssetsSection, AddAssetDiskDialog    |
| `docket/remove_asset`                              | `{ id, path, baseHash }`                                                                                                               | AssetsSection                        |
| `library/list` (query, topic `library`)            | `{}`                                                                                                                                   | AssetsSection                        |
| `file/stat`, `file/reveal`                         | `{ path }` (store-relative)                                                                                                            | AssetOpenMenu                        |
| `run/list` (query, topic `run`)                    | `{ cardId, limit: 100 }`                                                                                                               | CardRunsSection                      |
| `workflow/list` (query, topic `workflow`)          | `{}`                                                                                                                                   | CardRunsSection                      |
| `workflow/get` (call)                              | `{ id }`                                                                                                                               | RunWorkflowDialog (trigger inputs)   |
| `run/start`                                        | via `startRun(client, { workflowId, cardId, values? })`                                                                                | RunWorkflowDialog                    |
| `run/get`, `run/cancel`, `run/rerun`, `run/delete` | via `RunSheet`                                                                                                                         | CardRunsSection                      |

`CardPatch` (client type): `{ title?, body?, status?, start?: string|null,
due?: string|null, refs?: DocketRef[], links?: {to, rel: "relates"|"blocks"|"parent"|"duplicates"}[], fields?: Record<string, unknown> }`.

## DocketPage

```ts
export function DocketPage(): JSX.Element
```

- If `useOptionalFlowsClient()` returns a client, renders `DocketPageInner`
  directly; otherwise wraps it in `<FlowsClientGate>`.
- `DocketPageInner` state:

| State                           | Type                                      | Initial                                                                                                    |
| ------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `openId`                        | `string \| null`                          | URL search param `card` (`?card=<id>` opens the card panel on load; read once, URL not updated afterwards) |
| `editingCols`                   | boolean                                   | false                                                                                                      |
| `creating`                      | `string \| null` (column id for new card) | null                                                                                                       |
| `dragId`, `overCol`, `overCard` | `string \| null`                          | null                                                                                                       |
| `actionError`                   | `string \| null`                          | null                                                                                                       |
| `conflict`                      | boolean                                   | false                                                                                                      |

- Derived: `board = boardQ.data?.board ?? null`, `boardHash = boardQ.data?.hash ?? ""`,
  `cards = rankCards(cardsQ.data.items)` (memo), `columns = toUiColumns(board.columns)` (memo).
- `loading = (boardQ.loading && !boardQ.data) || (cardsQ.loading && !cardsQ.data)`;
  `loadError = boardQ.error ?? cardsQ.error`.
- Render order: loading → `DocketLoading`; error → `DocketLoadError`;
  no board → `DocketNoBoard` (its "Create board" calls `ensureBoard(client, null, boardHash)`, errors into `actionError`).
- Main render: `<Page fill crumbs=[{label:"Docket"}] data-testid="docket-page">`.
  - Header actions (`div.flex.gap-2`):
    - outline Button `docket-columns-open`, icon `Columns3`, text **Columns** → `editingCols=true`.
    - primary Button `docket-new-card-open`, icon `Plus`, text **New card** → `creating = columns[0]?.id ?? null`.
  - `PageTitle title="Docket" description="Cards wrap tickets, files and notes."`
  - If `conflict || actionError`: `Alert variant="destructive" data-testid="docket-conflict"`; title **Conflict** or **Could not update**; description **A card changed while you were editing. The board reloads from disk.** or the error text.
  - If no cards: `Empty className="mb-4" data-testid="docket-empty"`, icon `Inbox`, title **No cards**, description **Create a card to get started.** (lanes still render below).
  - `BoardLanes` (see below) with drag handlers.
  - `DocketDialogs`.
- `onMove(status, beforeId)`: ignored if no drag or `dragId === beforeId`;
  clears errors; `moveCard(...)`; `"conflict"` → `conflict=true`; other non-`"ok"` string → `actionError`. Always `endDrag()` after (clears drag state).

### DocketStates

All three use `<Page fill crumbs=[{label:"Docket"}] data-testid="docket-page">`.

| Component                                | Content                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocketLoading`                          | `PageTitle "Docket"`, description **Loading board…**; `div.flex.gap-4 data-testid="docket-loading"` with three `Skeleton className="h-80 w-72"`                                                                                                                                       |
| `DocketLoadError({error})`               | description **Could not load the board.**; `Alert destructive data-testid="docket-error"` title **Error**, body `errorMessage(error)`                                                                                                                                                 |
| `DocketNoBoard({onCreate, actionError})` | header action Button `docket-create-board` **Create board**; description **Cards wrap tickets, files and notes.**; `Empty data-testid="docket-empty-board"` icon `Inbox`, **No board yet** / **Create a board to start adding cards.**; optional destructive Alert with `actionError` |

## Board helpers

- `rankCards(cards)`: copy sorted by `rank.localeCompare`, tie on `id.localeCompare`.
- `ensureBoard(client, board, hash)`: if both exist return them; else save
  `{ version: 1, columns: DEFAULT_BOARD_COLUMNS, face: [] }` with
  `baseHash: hash` and return `{ board, hash: result.hash }`.
- `moveCard(client, cards, dragId, status, beforeId)` →
  `"ok" | "conflict" | string`. Missing face → `"ok"`. Uses the dragged
  card's `face.hash` as `baseHash`.
- `DEFAULT_BOARD_COLUMNS`: `todo` "Todo" idle; `doing` "Doing" working;
  `review` "Review" attention; `done` "Done" done + `done: true`.
- `toUiColumns(columns)`: `{ id, label, done, tone }` where tone = `"done"`
  if `col.done`, else `col.tone` if one of `idle|working|attention|done`, else `"idle"`.
- `refFromLink(link)`: parse with `new URL` (invalid → `null`); host minus
  `www.`; `system` = `"github"` if host ends with `github.com`, `"rally"` if
  ends with `rallydev.com`, else the host; `label = host + pathname` (pathname
  `/` → empty); `url = url.href`.
- `formatDate(iso)`: first 10 chars split on `-`; returns `"<Mon> <day>, <year>"`
  with English 3-letter months; returns input unchanged when malformed. No Date API.

## BoardLanes

Props: `columns: UiColumn[]`, `cards`, `dragId`, `overCol`, `overCard`,
`onOpen(id)`, `onDragStart(id)`, `onDragEnd()`, `onOverCol(colId)`,
`onOverCard(colId, cardId)`, `onDropCol(colId)`, `onDropCard(colId, beforeId)`, `onAdd(colId)`.

- Container: `flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto`.
- Per column `<section data-testid="docket-column-<id>">`:
  `flex max-h-full w-72 shrink-0 snap-start flex-col gap-2.5 overflow-hidden rounded-3xl p-2.5`
  - `LANE_BG[tone]` + when dragging over this column `ring-2 ring-ring ring-inset`.
    `onDragOver` preventDefault + `onOverCol`; `onDrop` preventDefault + `onDropCol` (append to end).
  * `ColumnHeader col count`.
  * Scroll area `flex min-h-0 flex-col gap-2.5 overflow-y-auto`, `data-testid="docket-scroll-<id>"`.
    - Empty lane: `Empty className="ring-1 ring-foreground/10" data-testid="docket-empty-<id>"`, icon `Inbox`, title **No cards**, description **Drop here** while dragging else **Drag a card to <label>**.
    - `CardTile` per card in that status (cards filtered by `card.status === col.id`).
  * Footer ghost Button `docket-add-<id>` `shrink-0 justify-start text-muted-foreground`, icon `Plus`, **Add card** → `onAdd(col.id)` (opens new-card dialog preset to that column).
- `LANE_BG`: idle `bg-muted/60`, working `bg-info/5`, attention `bg-warning/10`, done `bg-success/5`.

### ColumnHeader

`div.flex.items-center.gap-2.px-1.text-sm.font-medium` + `TONE_TEXT[tone]`.
Icon by tone (`size-4`): idle `Circle`, working `CircleDot`, attention
`CircleEllipsis`, done `CircleCheck`. Then label, then
`Badge variant="outline" className="bg-card text-foreground tabular-nums"`
showing the count zero-padded to 2 digits (`03`).

### CardTile

Props: `card: WireCardFace`, `dragging`, `showDrop`, `onOpen`,
`onDragStart`, `onDragEnd`, `onDragOver`, `onDrop`.

- If `showDrop` (dragging over this card, not itself): a drop indicator
  `div.h-0.5.rounded-full.bg-ring` rendered above the card.
- `Card` (ui) `draggable`, `role="button"`, `tabIndex=0`,
  `data-testid="docket-card-<id>"`, classes
  `@container/card shrink-0 cursor-grab transition-shadow outline-none ring-inset hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing active:ring-foreground/40`, plus `opacity-40` while dragging.
  - `dragstart`: `dataTransfer.effectAllowed = "move"`.
  - `dragover`/`drop`: preventDefault + stopPropagation (drop before this card).
  - click or Enter/Space → `onOpen`.
- `CardContent.flex.flex-col.gap-3`:
  - Title `line-clamp-2 min-h-10 text-sm leading-5 font-medium break-words`.
  - Meta row `flex min-h-6 items-center gap-3 text-xs text-muted-foreground`, each with `size-3.5` icon: due (`CalendarDays`, `formatDate(due)`), `assetCount > 0` (`FileText`, count), `linkCount > 0` (`Link2`, count), first ref's `system` (truncate).

## DocketDialogs

Props: `client, board, boardHash, columns, cardStatuses, cardIds,
editingCols, creating, openId, defaultStatus, onEditingCols, onCreating,
onOpenId, onConflict, onClearErrors`.

- `saveBoard(next, migrateStatus?)`: clear errors; `docket/save_board`
  `{ baseHash: boardHash, board: next, migrateStatus }`. Conflict →
  `onConflict()` and throw `Error("Board changed on disk. Reload and try again.")` (shown inside the dialog).
- `createCard(input)`: clear errors; `ensureBoard`; `docket/create_card`
  (`refs` filtered of nulls); then `onOpenId(input.id)` (opens the new card's panel).
- Renders `ColumnsDialog`, `NewCardDialog` (`open = creating !== null`,
  `defaultStatus = creating ?? columns[0].id`), `CardPanel cardId=openId`.

## ColumnsDialog

Props: `open, board, cardStatuses: string[], onOpenChange, onSave(board, migrateStatus?) => Promise<void>`.

- `DialogContent className="sm:max-w-xl" data-testid="docket-columns"`.
  Title **Columns**; description **Rename, reorder and add columns. A column id never changes, so renaming is safe. Mark a column Done when cards there are finished.**
- Local state: `draft: UiColumn[]` (copy of board columns), `migrateStatus`, `error`, `pending`. Opening resets all of these.
- Rows: `ColumnEditorRow` per draft column, list `flex flex-col gap-1.5`.
- Ghost Button **Add column** (`Plus`): appends `{ id: slug("column", ids), label: "New column", tone: "idle" }`. `slug`: lowercase, non-alnum → `-`, trim dashes, fallback `column`, dedupe with `-2`, `-3`…
- Remove: drops from draft; if that column existed and holds cards, set `migrateStatus` default to the first remaining id.
- "Gone" box (when removed columns still have cards): `div.flex.flex-col.gap-2.rounded-lg.bg-muted/50.p-3.text-sm` with **Move cards from <labels joined ", "> into:** and a `Select` (`data-testid="docket-columns-migrate"`) of draft columns.
- Save: any empty label → error **Every column needs a name.**; columns mapped to `{ id, label: trimmed, done, tone }`; `migrateStatus` passed only when removed columns had cards. Success closes; error shows in destructive Alert and re-enables.
- Footer: outline **Cancel**; Button `docket-columns-save` **Save** (disabled while pending).

### ColumnEditorRow

Props: `col, index, total, onPatch(id, partial), onShift(i, -1|1), onRemove(id)`.
`div.flex.items-center.gap-1.5 data-testid="columns-row-<id>"`:
ghost icon Buttons **Move up** (`ArrowUp`, disabled at first) and **Move down**
(`ArrowDown`, disabled at last); `Input aria-label="Column name"` (`min-w-0 flex-1`);
tone `Select` (trigger `w-32` + `TONE_TEXT[tone]`, `aria-label="Tone"`,
`alignItemWithTrigger={false}`) with Idle / Working / Attention / Done;
`Checkbox` labelled **Done**; ghost icon Button `aria-label="Delete <label>"` (`Trash2`, disabled when only one column).

## NewCardDialog

Props: `open, defaultStatus, columns: BoardColumn[], existingIds, onOpenChange, onCreate(input) => Promise<void>`.
`NewCardInput = { id, title, status, body?, refs? }`.

- `DialogContent sm:max-w-md data-testid="docket-new-card"`. Title **New card**; description **Add a card to the board. Add a ref to the source ticket now, or attach files later.**
- Fields (`Field` + `FieldLabel`):
  - **Title** `Input#nc-title data-testid="docket-new-card-title"` placeholder **What needs doing?**
  - **Column** `Select` of columns (initial `defaultStatus`).
  - **Ref** `Input#nc-ref data-testid="docket-new-card-ref"` placeholder **Optional: URL of the ticket or page this card wraps**
  - **Description** `Textarea#nc-body rows=3` placeholder **Optional Markdown**
- Submit: empty title → **Title is required.**; non-empty ref that fails `refFromLink` → **Ref must be a full URL, for example https://...**. Id = slug of title (lowercase, non-alnum → `-`, trim, max 40 chars, fallback `card`, dedupe against `existingIds` with `-2`…). Body trimmed or undefined. On success: reset + close.
- Footer: outline **Cancel**; Button `docket-new-card-submit` **Create** (disabled while pending). Closing resets fields.

## CardPanel (right Sheet)

`Sheet open={cardId !== null}`; `SheetContent className="data-[side=right]:sm:max-w-5xl" data-testid="docket-panel"`; body `CardPanelBody key=cardId`.

### CardPanelBody

Queries: `docket/get_card {id}`, `docket/get_board`, `docket/list_cards` (all topic `docket`).
State: `confirming`, `conflict`, `saveError`.

- `patch(next)` → `docket/update_card { id, baseHash: data.hash, patch }`; conflict → `conflict=true`, else `saveError`.
- Loading: `div.flex.flex-col.gap-3.p-4` with `Skeleton h-8 w-2/3` + `Skeleton h-40 w-full`.
- Error (no data): `Alert destructive className="m-4"` **Could not load card** + message.
- Layout:
  - `CardPanelHeader`.
  - Grid `grid min-h-0 flex-1 grid-cols-1 overflow-y-auto border-t md:grid-cols-3 md:overflow-hidden`.
    - Left (`md:col-span-2 md:border-r`, `flex flex-col gap-4 overflow-y-auto p-4`): `RefsSection`, `PropertiesSection`, `Section "Description"` containing multiline `InlineText` (label `description`, placeholder **Add a description**) saving `body`.
    - Right (`flex min-h-0 flex-col` → inner `flex flex-1 flex-col gap-4 overflow-y-auto p-4`): `CardRunsSection` (assetNames = basenames of asset paths), `LinksSection` (stored links as `{to, rel}`, backlinks, allCards `{id,title}` from list), `AssetsSection`, then `div.border-t.pt-4` > `RefDataSection`.
  - `ConfirmDialog` title **Delete this card?**, description **The card and its owned assets are removed. Linked files stay where they are.**, confirm **Delete** → `docket/delete_card {id}` then `onDeleted` (closes panel).

### CardPanelHeader

Props: `id, title, due?, conflict, saveError, onSaveTitle, onDelete`.

- `SheetHeader`: top row `flex items-center justify-between pr-8 text-sm text-muted-foreground` with `SquareKanban` + **Card** and a ghost icon dropdown (`aria-label="Card actions"`, `MoreHorizontal`) containing destructive item `docket-delete` (`Trash2`) **Delete card**.
- `SheetTitle className="sr-only"` = title; visible title is `InlineText label="title" placeholder="Untitled" className="font-heading text-xl font-medium"`.
- `SheetDescription`: `<id>` plus ` · Due <formatDate(due)>`.
- Alert (`mx-4`, `data-testid="docket-conflict"`): **Conflict** / **This card changed on disk. Close and reopen to reload.** or **Could not save** / message.

### InlineText

Props: `value, onSave(value), label, placeholder="Empty", multiline?, type: "text"|"date" = "text", format?(value), className?`.

- Display mode: `div role="button" tabIndex=0 aria-label="Edit <label>"`, classes
  `-mx-2 flex min-h-8 w-full cursor-text rounded-md px-2 text-left break-words whitespace-pre-wrap outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring`
  plus `items-start py-1.5` (multiline) or `items-center`, plus `text-muted-foreground` when empty. Shows `format(value)` or value or placeholder. Click / Enter / Space starts editing with draft = value.
- Edit mode: autofocused `Textarea rows=6` (multiline) or `Input type` with `aria-label=label`. Blur commits. Escape cancels (no save). Enter commits (multiline needs Cmd/Ctrl+Enter). Save only when draft differs.

### SectionParts

| Part                               | Spec                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Section({title, children})`       | `Collapsible defaultOpen render=<section>` `flex flex-col gap-1 border-t pt-4 first:border-t-0 first:pt-0`; trigger `group/trigger flex w-fit items-center gap-1.5` with `h3.font-heading.text-base.font-medium` and `ChevronDown size-4 -rotate-90 text-muted-foreground` rotating to 0 when `data-panel-open`; content `flex flex-col gap-0.5 pt-1` |
| `EmptyLine({children="None yet"})` | `p.min-h-8.py-1.5.text-muted-foreground`                                                                                                                                                                                                                                                                                                              |
| `Row({label, children, action?})`  | `group/row flex min-h-8 items-center gap-2`; label `w-28 shrink-0 truncate text-muted-foreground`; value `flex min-h-8 min-w-0 flex-1 items-center`; then action                                                                                                                                                                                      |
| `ListRow({children, onOpen?})`     | `group/row -mx-2 flex min-h-8 items-center gap-2 rounded-md px-2 hover:bg-muted` (+ `cursor-pointer`, role button, Enter/Space when `onOpen`)                                                                                                                                                                                                         |
| `RemoveButton({label, onClick})`   | ghost icon `X`, `aria-label=label`, `ml-auto shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100`; stops propagation                                                                                                                                                                                                             |
| `Adder({label, children(done)})`   | closed: ghost Button `-mx-2 w-fit justify-start px-2 text-muted-foreground` with `Plus` + label; open: `div.flex.gap-2` with `children(done)` + ghost icon `X` **Cancel**                                                                                                                                                                             |

### PropertiesSection

Props: `status, start?, due?, fields: Record<string, unknown>, columns, onChange(PropertyPatch)`.
`Section "Properties"`:

- Row **Status**: `Select` of columns, trigger `aria-label="Status" data-testid="docket-prop-status"` `-mx-2 border-transparent bg-transparent px-2 hover:bg-muted` → `{status}`.
- Row **Start** / **Due**: `InlineText type="date"` (labels `start date` / `due date`, placeholder **Set date**, `format=formatDate`) → `{start: v || null}` / `{due: v || null}`.
- One Row per custom field (label = key): `InlineText` of `fieldText(value)` (strings as is, number/bool String, else JSON) → `{fields: {...fields, [k]: next}}`; action `RemoveButton "Remove property <k>"` → `{fields: rest}`.
- `Adder "Add property"`: Inputs `docket-prop-name` (placeholder **Name**, autofocus) and `docket-prop-value` (**Value**), outline Button `docket-prop-add` **Add** (disabled without name); Enter in either adds.

### RefsSection

`Section "Refs"`. Each ref: `ListRow` with `Badge secondary` system, optional id, link
(`target=_blank rel=noreferrer`, `truncate text-muted-foreground underline-offset-4 hover:underline`, text `label ?? url`) or muted span, optional `formatDate(syncedAt)` (xs muted), `RemoveButton "Remove ref <label|id|system>"`.
Empty: **No refs yet**. `Adder "Add ref"`: `Input data-testid="docket-ref-url"` placeholder `https://...` (`aria-invalid` when parse failed), outline Button `docket-ref-add` **Add**; Enter adds. Invalid URL just marks the input invalid.

### RefDataSection

`Section "Ref data"`. For each ref with non-empty `data` object:
`div.flex.flex-col.gap-0.5 data-testid="ref-data-block"`: header row (`Badge secondary` system, id or label, right `Synced <RelativeTime>` when `syncedAt`), then `Row` per key (non-strings JSON-stringified, truncate).
Empty: `EmptyLine` (**None yet**) + xs muted **A connector fills this from the ref when it syncs.**

### LinksSection

Props: `cardId, links: CardLink[], backlinks: {from, rel}[], allCards: {id,title}[], onChange(links)`.
Rels = `cardLinkRelSchema.options` (`relates`, `blocks`, `parent`, `duplicates`).
`Section "Links"`:

- Each link: `ListRow` with `Badge outline` rel, title of target (`<id> (deleted)` when missing), `RemoveButton "Remove link to <title>"`. Empty **No links yet**.
- Each backlink: `Badge secondary` with backlink wording (`relates`→**related to**, `blocks`→**blocked by**, `parent`→**child of**, `duplicates`→**duplicated by**) + source title. Not removable.
- `Adder "Add link"`: rel `Select` (`docket-link-rel`, default `relates`), target `Select` (`docket-link-target`, placeholder **Card**, excludes self), outline `docket-link-add` **Add** (disabled until target).

### AssetsSection

Props: `client, cardId, baseHash, assets, onMutated`.

- Query `library/list`. Reads `home` from `(await client.ready).workspace.home`.
- Library item path convention: `<home>/library/<itemId>`. Items already linked are hidden from the picker.
- Each asset: `ListRow` with `File` icon, `label ?? basename(path)`, `Badge secondary` scope (`owned`/`linked`), destructive `Badge` **Missing** when `missing`, `AssetOpenMenu compact storePath=<path relative to home> triggerTestId="asset-open-menu" onRemove` (→ `docket/remove_asset`). Empty **No assets yet**.
- `Adder "Add asset"`: a `Combobox defaultOpen` over library items (label = title, value = id) with `ComboboxInput data-testid="asset-picker"` placeholder **Search the Library** (`aria-label="Asset from the Library"`), `ComboboxContent align="end" className="w-80"`, empty text **Nothing else in the Library**, items show title + xs muted kind; footer (`border-t p-1`) ghost full-width Button `asset-add-from-disk` (`HardDriveUpload`) **Add from disk…** → opens `AddAssetDiskDialog`. Picking an item → `docket/add_asset` linked with `label: item.title`.
- Errors: `p.text-sm.text-destructive role="alert"`.
- When `home` known, a folder-level `AssetOpenMenu storePath="docket/cards/<id>/assets"` (non-compact: shows `~/.flowapp/<storePath>` in mono xs muted).

### AssetOpenMenu

Props: `client, storePath, home, onRemove?, compact?, triggerTestId = "item-open-menu"`.

- Row with path text (non-compact) and outline icon Button (`aria-label="Open in"`, `ExternalLink`).
- Menu (align end): `item-view-files` (`Expand`) **View in Files** → navigate `/files`; `item-open-finder` (`FolderOpen`) **Finder** → `file/stat {path}` then `file/reveal {path}`, note **Revealed in Finder (<kind>)** or error text; `item-open-cursor` (`Code`) **Cursor** → `window.open("cursor://file<home>/<storePath>", "_self")`, note **Opening in Cursor…**; with `onRemove`: separator + destructive `asset-remove` (`Trash2`) **Remove asset**.
- Note line `text-xs text-muted-foreground data-testid="item-open-note"`.

### AddAssetDiskDialog

Props: `open, onOpenChange, client, cardId, baseHash, onAdded`.
`DialogContent sm:max-w-md data-testid="asset-disk-dialog"`; title **Add asset from disk**; description **Files are copied into this card’s assets folder. The originals stay where they are.** Body `DiskPickerBoth` with `chosenNote="copied into the card assets folder"`, `emptyHint="Nothing chosen. Files are copied into the card; the originals stay where they are."`.
Submit: for each picked file sequentially `uploadBlob(client, { scope: "docket/cards/<id>/assets", name, body: file, mime })` then `docket/add_asset { scope: "owned", blobId, name, label: folder ? "<folder>/<name>" : undefined, baseHash: hash }`, chaining `hash = result.hash`. Footer: outline **Cancel** (disabled busy); Button `asset-disk-submit` **Add** / **Adding…**. Errors as `p.text-sm.text-destructive role=alert`.

### CardRunsSection

Props: `cardId, title, refs, assetNames`.

- Queries `run/list {cardId, limit: 100}` (topic `run`), `workflow/list {}` (topic `workflow`).
- State `running` (dialog), `pickId` (RunSheet), `conflict`, `actionError`.
- `Section "Runs"`:
  - Error Alert `card-runs-error`: **Conflict** / **This run changed elsewhere. Close the sheet and try again.** or **Could not update** / message.
  - Empty **No runs yet**; else `div.flex.flex-col.gap-0.5 data-testid="card-runs-list"` of `<button data-testid="card-run-row-<runId>">` (`-mx-2 flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted`): `StatusPill` from `statusOf(status, needsYou.length>0)`, workflow name (`workflowName || workflowId`), xs muted tabular `done/total · <RelativeTime startedAt>`. Click → open RunSheet.
  - Ghost Button `card-run-open` (`Play`) **Run workflow**.
  - `RunWorkflowDialog`; on started → open RunSheet with the new run.
  - `RunSheet runId=pickId` (rerun switches `pickId` to the new run).

### RunWorkflowDialog

Props: `card: {id, title, refs, assetNames}, open, workflows: WorkflowSummary[], onOpenChange, onStarted(runId), onConflict, onError(message)`.

- `DialogContent sm:max-w-md data-testid="card-run-dialog"`; title **Run a workflow**; description **Solve this card with a workflow. Inputs are filled from the card; change them if needed. Running again starts the next attempt.**
- **Workflow** `Select` (`card-run-workflow`, placeholder **Choose a workflow**, labels `workflowLabel(w)`); shows `workflow.goal` as xs muted text.
- On pick: `workflow/get {id}` → input names = `inputs[].name` of the first node with `kind === "trigger"`.
- One `Input#rw-<name> data-testid="card-run-input-<name>"` per input, default from `guess(name, card)`:
  name contains `ticket`/`story` → first ref id or label; `file`/`changelog` → first asset name; `version` → first match of `/v?\d+(\.\d+)+/` in title; else the card title. Edits keyed `<workflowId>:<name>`.
- **Start run** (`card-run-start`, `Play`, disabled without workflow or pending) → `startRun({workflowId, cardId, values?})` (values only when there are inputs). Ok → close and `onStarted(runId)`; conflict → `onConflict`; error → `onError`. Outline **Cancel**.
