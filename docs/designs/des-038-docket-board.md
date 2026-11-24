---
id: DES-038
title: Docket board
type: design
status: draft
summary: "MVP of the new Kanban: a board of cards that wrap external tickets, local assets and other cards as plain files."
tags: [board, kanban, work-items, assets, design]
related: [DES-016, DES-026, DES-008]
updated: 2026-11-23
---

# Docket board

## Intent

A card is a **wrapper**, not a ticket system. Rally, Jira, GitHub and the
like stay the source of truth for their own fields. A card holds a pointer
to them, a snapshot of what an agent needs, and the local files around the
work. The board stays tiny because everything else is a file attached to a
card.

Why now: agents read and write files, not forms. A ticket broken into JSON
and Markdown assets is something an agent can open, edit and hand to a
workflow with no per-system integration in the board.

Name: **Docket** is the board (a list of cases, each pointing at its
papers). An item is a **card**. This replaces the Work items page and its
record model (DES-026); see Migration.

## Principles

1. **Files are the model.** One folder per card; Markdown plus YAML
   frontmatter. No database table for cards. Humans, agents and git see the
   same thing.
2. **Wrap, don't mirror.** The board knows five things: title, description,
   status, dates and links. Anything else is a ref, an asset or a free
   `fields` entry.
3. **Open schema.** Unknown frontmatter keys survive every save. Systems add
   data without a board release.
4. **Tolerant reader.** A hand-edited or half-valid card still renders, with
   a warning, and is never dropped or rewritten silently.
5. **One writer path.** The UI, the server and agents edit the same files;
   the hash check (409) settles conflicts, as for workflows.

## Must-haves (MVP)

| Area   | Must-have                                                                       |
| ------ | ------------------------------------------------------------------------------- |
| Card   | title, Markdown description, status, dates (start, due, created, updated, done) |
| Refs   | links to external items (Rally, Jira, GitHub, any URL) with system and id       |
| Assets | local files, folders, images attached or linked; open, add, remove              |
| Links  | card to card with a relation; backlinks shown on the target                     |
| Fields | free key/value map for any other system field, shown in the detail panel        |
| Board  | configurable columns (id, label, done flag); drag to change status and order    |
| Live   | board follows file changes (agent edits appear without refresh)                 |
| Safety | optimistic move with rollback; 409 on a stale save; missing assets flagged      |

Out of MVP: WIP limits, derived columns, swimlanes, several boards, search,
undo, automated sync, move triggers, bulk actions, card templates.

## Data model

### Layout

```
$FLOWAPP_HOME/docket/
  board.yaml                 # columns and card face
  cards/
    <card-id>/
      card.md                # frontmatter + description
      assets/                # owned files, copied in
        rally-US1234.json
        acceptance.md
```

`<card-id>` is a slug, never renamed (same rule as a work item id). The
title may change freely.

### card.md

```markdown
---
id: fix-flaky-login
title: Fix flaky login test
status: doing
rank: "m"
start: 2026-11-20
due: 2026-11-28
created: 2026-11-20T09:12:00Z
updated: 2026-11-23T08:00:00Z
done: null
refs:
  - system: rally
    kind: story
    id: US1234
    url: https://rally.example/slm/...
    label: Login flake on CI
    syncedAt: 2026-11-23T07:55:00Z
    snapshot: assets/rally-US1234.json
assets:
  - path: assets/acceptance.md
    label: Acceptance criteria
  - path: /Users/me/Screens/flake.png
    label: Failure screenshot
    scope: linked
links:
  - to: refactor-auth-session
    rel: blocks
fields:
  assignee: dbx
  x-rally:
    iteration: Sprint 42
---

Free Markdown description. Agents may append notes here.
```

### Schema rules (zod in `packages/shared`, loose by design)

- Required: `id`, `title`, `status`, `created`, `updated`.
- `status` is any string. A value not in `board.yaml` renders in a
  synthetic **Unsorted** column, so nothing disappears when columns change.
- `rank` is a short fractional string (lexicographic order inside a
  column). A move rewrites one card only, so two agents moving different
  cards never conflict.
- Dates are ISO. `updated` is set by the writer; `done` is set when the
  card enters a column flagged `done`, cleared when it leaves.
- Unknown top-level keys pass through unchanged (`.passthrough()`), and
  the writer preserves key order and comments (same YAML helpers as
  workflows).
- `fields` is `Record<string, JSON>`. Convention: a system puts its own
  data under `x-<system>`; plain keys are board-wide (`assignee`, `labels`).

### Ref

A pointer to an item in another system.

| Key      | Meaning                                                       |
| -------- | ------------------------------------------------------------- |
| system   | `rally`, `jira`, `github`, `url`, or any string               |
| kind, id | optional; system-local type and identifier                    |
| url      | where the human opens it                                      |
| label    | display title cached from the system                          |
| syncedAt | when `snapshot` was last written                              |
| snapshot | optional asset path holding the broken-down copy (JSON or MD) |

The board never calls an external API itself. A connector or agent writes
the snapshot asset and updates `syncedAt`; the card shows its age
(freshness, as for Context links today).

### Asset

| Key   | Meaning                                                             |
| ----- | ------------------------------------------------------------------- |
| path  | relative to the card folder (owned) or absolute (linked)            |
| label | optional display name                                               |
| scope | `owned` (default for relative) or `linked` (absolute, never copied) |

Kind (file, folder, image, JSON, Markdown) is derived from the path, not
stored. Owned assets live in the card folder and travel with it. Linked
assets stay where they are; the card shows **Missing** if the path is gone
and never deletes the target. Removing an asset from a card removes the
entry; deleting the owned file is a separate, confirmed action.

### Card link

`{ to, rel }` with `rel` in `relates`, `blocks`, `parent`, `duplicates`.
Stored on one side only. Backlinks come from the index, so the target card
file is never touched. A link to a deleted card shows as dangling.

### board.yaml

```yaml
version: 1
columns:
  - { id: todo, label: Todo }
  - { id: doing, label: Doing }
  - { id: review, label: Review }
  - { id: done, label: Done, done: true }
face: [due, fields.assignee] # extra keys on the card face, max 2
```

Columns are the only configuration. A column id is what cards store in
`status`, so renaming a label is free and renaming an id is a migration the
UI performs explicitly (rewrites affected cards).

## Architecture

```
card files ──watch──> engine/docket index ──> server REST + ws ──> web board
     ^                                              |
     └──────── hash-checked writes <────────────────┘
agents / connectors / workflows read and write the same files
```

- `packages/shared`: `cardSchema`, `refSchema`, `assetSchema`, `boardSchema`,
  API bodies, websocket message `docket_changed`.
- `packages/engine/src/docket/`: `store.ts` (read, write with hash,
  tolerant parse, YAML edits that keep unknown keys), `index.ts` (in-memory
  list, backlinks, missing-asset check, rebuilt from files, no second
  source of truth), `watch.ts` (reuses the file watch layer), `rank.ts`.
- `apps/server`: routes below.
- `apps/web/src/pages/docket/`: `DocketPage`, `Board`, `Column`,
  `CardTile`, `CardPanel` (side sheet), `RefList`, `AssetList`,
  `LinkList`, `FieldsTable`, `ColumnsDialog`. State from one list query
  plus websocket invalidation; no client cache of card bodies.

### API

| Route                            | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `GET /docket`                    | board config and card summaries (no bodies)           |
| `PUT /docket/board`              | save columns and face (hash, 409)                     |
| `POST /docket/cards`             | create (title, optional status, ref or description)   |
| `GET /docket/cards/:id`          | full card, hash, backlinks, asset states              |
| `PUT /docket/cards/:id`          | save fields and body (`baseHash`, 409 with disk copy) |
| `POST /docket/cards/:id/move`    | `{ status, beforeId? }` rewrites status and rank only |
| `POST /docket/cards/:id/assets`  | add owned (upload) or linked (path)                   |
| `GET /docket/cards/:id/assets/*` | stream an owned asset                                 |
| `DELETE /docket/cards/:id`       | delete card (confirmed; owned assets go with it)      |

Linked paths are opened through an allow-listed "reveal/open" action on the
server (localhost only); the browser never reads arbitrary paths.

## UI

- Board: columns left to right, cards stacked by `rank`. A card face shows
  title, source badge (system of the first ref), status-independent chips
  for due date and asset/link counts, and up to two `face` fields. Detail
  stays off the face.
- Card panel (side sheet, not a route change): description editor, Refs,
  Assets, Links (with backlinks), Fields, Dates. Each list has an add row.
- Drag and drop plus keyboard move (select, arrows, drop) with live-region
  announcements. A rejected or failed move snaps back with a toast.
- Empty, loading, error and conflict states are defined in `DESIGN.md`
  when the mockup lands; visual rules follow `apps/web/DESIGN.md`.

## Differences from the old pattern

| Old (Work items, KanbanMockup)                   | Docket                                              |
| ------------------------------------------------ | --------------------------------------------------- |
| Fixed four columns derived from run state        | User columns; status is plain data                  |
| Strict record, unknown keys are errors           | Open schema, unknown keys preserved                 |
| Source is a closed union (adhoc, library, rally) | Any number of refs, any system                      |
| Attachments are uploads only                     | Owned and linked assets, snapshots of external data |
| Notes in a separate file                         | Description is the card body                        |
| Card is a work item plus run status              | Card wraps; runs are linked, not the model          |
| Column order stored in a list                    | Per-card `rank`, one-file moves                     |

## Integration contract (not built in MVP)

- **Connectors** implement `snapshot(ref) -> assets`, writing JSON/MD into
  the card folder and stamping `syncedAt`. The MVP adds refs by hand.
- **Workflows** may take a card id as input: the run gets the card folder
  path, and nodes may add assets through the normal propose/publish gate.
- **Runs** appear as a ref with `system: flows-run`, so history stays
  linked without the board owning run state.

## Migration

Existing work items map one to one: `title`, `source` and `links` become
refs, `notes` becomes the body, attachments become owned assets,
`workflowId` and `inputs` move to `fields.x-flows`. A one-time import
writes cards and leaves the old store untouched; `/work-items` redirects to
`/docket` after the import.

## Risks

- Hand edits can break YAML: mitigated by the tolerant reader and a
  per-card parse warning.
- Large asset folders: the board only lists names and counts; nothing is
  copied for linked assets.
- Two writers on one card: hash check plus last-write-wins on `rank` only.
- Unsorted column surprises after a column delete: the delete dialog lists
  affected cards and offers a target column.

## Open questions

1. Do runs stay a first-class area (Runs page) or become card refs only?
2. Is `Unsorted` acceptable, or should deleting a column force a target?
3. Drag and drop library: reuse what the repo already ships, else add one
   (to verify before BL).
