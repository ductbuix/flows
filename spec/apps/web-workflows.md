# apps/web — Workflows list, sheet and editor page

Part of the [web spec](web.md). Routes `/workflows` (list) and
`/workflows/:id` (editor). The node canvas inside the editor is specified
in [web-workflows-canvas.md](web-workflows-canvas.md).

Files: `src/pages/workflows/*.ts(x)` (top level, 16 source files).

## File map

| File                     | Exports                                                                                                                           | Role                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `WorkflowsPage.tsx`      | `WorkflowsPage`                                                                                                                   | `/workflows` route                         |
| `WorkflowsStates.tsx`    | `WorkflowsLoading`, `WorkflowsLoadError`                                                                                          | States                                     |
| `WorkflowsTable.tsx`     | `WorkflowsTable`                                                                                                                  | Table of workflows                         |
| `WorkflowRowMenu.tsx`    | `WorkflowRowMenu`                                                                                                                 | Row "…" menu (Rename, Delete)              |
| `NewWorkflowDialog.tsx`  | `NewWorkflowDialog`                                                                                                               | Create / rename dialog                     |
| `WorkflowDialogs.tsx`    | `WorkflowDialogs`                                                                                                                 | New, rename, delete confirm                |
| `WorkflowSheet.tsx`      | `WorkflowSheet`                                                                                                                   | Right Sheet wrapper                        |
| `WorkflowSheetBody.tsx`  | `WorkflowSheetBody`                                                                                                               | Sheet content                              |
| `WorkflowSheetRuns.tsx`  | `WorkflowSheetRuns`                                                                                                               | Runs grouped by card                       |
| `WorkflowSheetStart.tsx` | `WorkflowSheetStart`                                                                                                              | Footer: pick card + start                  |
| `workflow-actions.ts`    | `slugify`, `uniqueWorkflowId`, `createWorkflow`, `updateWorkflowMeta`, `deleteWorkflow`, `saveWorkflowYaml`, `saveWorkflowLayout` | FCP helpers                                |
| `sheet-actions.ts`       | `SheetActionResult`, `renameWorkflowName`, `renameWorkflowId`, `saveWorkflowInputs`                                               | Sheet FCP helpers                          |
| `editor-save.ts`         | `SaveOutcome`, `saveEditor`                                                                                                       | Validate + save yaml/layout                |
| `WorkflowEditorPage.tsx` | `WorkflowEditorPage`                                                                                                              | `/workflows/:id` route                     |
| `EditorChrome.tsx`       | `EditorChrome`                                                                                                                    | Page frame, Save, alerts, Canvas/YAML tabs |

## FCP calls

| Method                                           | Params                                                                                        | Where                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `workflow/list` (query, topic `workflow`)        | `{}` → `{ items: WorkflowSummary[] }` (`id`, `name?`, `goal?`, `taskCount`)                   | WorkflowsPage                                                                |
| `workflow/get` (query or call, topic `workflow`) | `{ id }` → `WorkflowDetail` `{ yaml, hash, workflow: Workflow \| null, layout?: LayoutFile }` | sheet, editor, actions                                                       |
| `workflow/create`                                | `{ id, name, goal }`                                                                          | createWorkflow                                                               |
| `workflow/save`                                  | `{ id, yaml, baseHash }` → `{ hash }`                                                         | updateWorkflowMeta, renameWorkflowName, saveWorkflowInputs, saveWorkflowYaml |
| `workflow/save_layout`                           | `{ id, layout }` → written `LayoutFile`                                                       | saveWorkflowLayout                                                           |
| `workflow/validate`                              | `{ yaml }` → `{ errors: {message}[] }`                                                        | saveEditor                                                                   |
| `workflow/delete`                                | `{ id }`                                                                                      | deleteWorkflow                                                               |
| `workflow/rename`                                | `{ id, newId, requestKey: crypto.randomUUID() }`                                              | renameWorkflowId                                                             |
| `run/list` (query, topic `run`)                  | `{ workflowId, limit: 100 }`                                                                  | sheet                                                                        |
| `docket/list_cards` (query, topic `docket`)      | `{}`                                                                                          | sheet                                                                        |
| `run/start`                                      | via `startRun({workflowId, cardId})`                                                          | sheet                                                                        |

YAML edits use comment-preserving helpers from `@workspace/contracts`:
`setWorkflowField(yaml, key, value|undefined)` and
`setNodeKey(yaml, nodeId, key, value|undefined)` (undefined removes the key).

## workflow-actions.ts

```ts
export function slugify(name: string): string // lowercase, non [a-z0-9] runs → "-", trim dashes
export function uniqueWorkflowId(
  name: string,
  existing: readonly WorkflowSummary[]
): string
export function createWorkflow(
  client,
  id,
  name,
  goal
): Promise<"ok" | "conflict" | string>
export function updateWorkflowMeta(
  client,
  id,
  name,
  goal
): Promise<"ok" | "conflict" | string>
export function deleteWorkflow(client, id): Promise<"ok" | string>
export function saveWorkflowYaml(
  client,
  id,
  yaml,
  baseHash
): Promise<{ ok: true; hash: string } | "conflict" | string>
export function saveWorkflowLayout(
  client,
  id,
  layout
): Promise<{ ok: true; layout: LayoutFile } | string>
```

- `uniqueWorkflowId`: `slugify(name).slice(0, 40) || "workflow"`, then `-2`, `-3`… while taken.
- `updateWorkflowMeta`: `workflow/get`, then `setWorkflowField(yaml, "name", name)` and `"goal"`, then `workflow/save` with the fetched hash.
- Conflict detection everywhere is `isConflictError`; other errors become `errorMessage(err)`.

## sheet-actions.ts

```ts
export type SheetActionResult = "ok" | "conflict" | string
export function renameWorkflowName(client, id, name): Promise<SheetActionResult> // name.trim() || undefined removes the key
export function renameWorkflowId(client, id, newId): Promise<SheetActionResult> // workflow/rename
export function saveWorkflowInputs(
  client,
  id,
  triggerId,
  inputs: WorkflowInputDecl[]
): Promise<SheetActionResult>
```

`saveWorkflowInputs` sets the trigger node's `inputs` key (`undefined` when the list is empty) and saves.

## editor-save.ts

```ts
export type SaveOutcome =
  | { kind: "ok"; hash?: string; layout?: LayoutFile }
  | { kind: "conflict" }
  | { kind: "validation"; messages: string[] }
  | { kind: "error"; message: string }
export function saveEditor(opts: {
  client
  id
  yaml
  baseHash
  yamlDirty
  layoutDirty
  layoutDraft: LayoutFile | null
}): Promise<SaveOutcome>
```

Order: if `yamlDirty` → `workflow/validate {yaml}`; any errors → `validation`
with each `message`; else `saveWorkflowYaml` (conflict / error / hash).
Then if `layoutDirty && layoutDraft` → `saveWorkflowLayout`. Return `ok`
with whichever of `hash` / `layout` were written.

## WorkflowsPage (`/workflows`)

- Gate pattern as elsewhere (inner directly, else inside `FlowsClientGate`).
- Query `workflow/list {}` topics `["workflow"]`.
- State: `search` (string), `openId` (sheet), `creating`, `renamingId`, `deletingId`, `conflict`, `actionError`.
- Filter (`shown`): query `q = search.trim().toLowerCase()`; matches id, `workflowLabel(w)` or `goal` (case-insensitive substring).
- Loading → `WorkflowsLoading`; error → `WorkflowsLoadError`.
- `<Page crumbs=[{label:"Workflows"}] data-testid="workflows-page">`:
  - Header action: Button `workflows-new-open` (`Plus`) **New workflow**.
  - `PageTitle title="Workflows" description="Each workflow solves one type of task the same way every time."`
  - Alert `workflows-conflict`: **Conflict** / **A workflow changed while you were editing. The list reloads from disk.** or **Could not update** / message.
  - Search: `InputGroup className="max-w-sm shrink-0"` with `Search` addon and `InputGroupInput` placeholder **Search workflows**, `data-testid="workflows-search"`.
  - Empty: `Empty className="ring-1 ring-foreground/10" data-testid="workflows-empty"`, icon `FolderOpen`; no items → **No workflows yet** / **Create one to get started.**; else **No matching workflows** / **Try a different search.**
  - Else `WorkflowsTable`.
  - `WorkflowDialogs` (create navigates to `/workflows/<newId>` on success).
  - `WorkflowSheet workflow={items.find(openId)}`; `onRenamedId` switches `openId` to the new id.

### WorkflowsStates

- `WorkflowsLoading`: same title/description; `div.space-y-3 data-testid="workflows-loading"`: `Skeleton h-9 w-full max-w-sm`, then a `rounded-xl ring-1 ring-foreground/10 overflow-hidden` box with 5 rows (`flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0`, left `Skeleton h-4 w-40` over `h-3 w-56`, right `h-4 w-8`).
- `WorkflowsLoadError`: description **Could not load workflows.**, Alert `workflows-error` **Error** + message.

### WorkflowsTable

Props `shown, onOpen(id), onRename(id), onDelete(id)`. Wrapper `div.shrink-0`; `Table data-testid="workflows-table"`.
Columns: **Solves** | **Tasks** (right) | blank `w-12`.
Row `TableRow.cursor-pointer data-testid="workflow-<id>"` click → `onOpen` (sheet):

- cell 1: `font-medium` `workflowLabel(w)` above `max-w-md truncate text-xs text-muted-foreground` goal.
- cell 2: `text-right tabular-nums font-mono` `taskCount`.
- cell 3 (click stops propagation): `WorkflowRowMenu name=workflowLabel(w)`.

### WorkflowRowMenu

Ghost icon Button `aria-label="Actions for <name>"` (`MoreHorizontal`); menu align end: **Rename** (`Pencil`), destructive **Delete** (`Trash2`).

### NewWorkflowDialog

Props: `open, initial?: {name, solves}, onOpenChange, onCreate(name, solves)`.

- `DialogContent sm:max-w-md data-testid="workflows-new"`.
- Title **New workflow** / **Rename workflow** (when `initial`).
- Description: create → **A workflow solves one type of task the same way every time. It starts with a manual trigger; add the rest in the editor.**; rename → **Change the name or the type of task. The id and past runs stay the same.**
- Fields: **Name** `Input#nw-name data-testid="workflows-new-name"` placeholder **Fix flaky test**; **Type of task it solves** `Input#nw-solves` placeholder **A test fails intermittently on CI**.
- Submit: empty name → **Name is required.**; else `onCreate(name.trim(), solves.trim())` and close (sync; errors surface on the page).
- Footer: outline **Cancel**; `workflows-new-submit` **Create** / **Save**.

### WorkflowDialogs

- Create: id = `uniqueWorkflowId(name, items)`; goal = `solves || name`; `createWorkflow` → ok → `onCreated(id)`; conflict → page conflict; else error.
- Rename (keyed by workflow id, open while `renamingId` set): initial `{ name: w.name ?? w.id, solves: w.goal ?? "" }`; `updateWorkflowMeta(id, name, solves || name)`; always clears `renamingId`.
- Delete: `ConfirmDialog` **Delete this workflow?** / **Its workflow.yaml and folders are removed. Cards stay as they are.** / confirm **Delete** → `deleteWorkflow`.

## WorkflowSheet (list detail panel)

`Sheet open={!!workflow}`; `SheetContent className="data-[side=right]:sm:max-w-lg" data-testid="workflow-sheet"`; body keyed by workflow id.

### WorkflowSheetBody

Props: `workflow: WorkflowSummary, onClose, onRenamedId?`.
Queries: `workflow/get {id}` (topic `workflow`), `run/list {workflowId, limit:100}` (topic `run`), `docket/list_cards {}` (topic `docket`).
State: `cardId`, `pending`, `conflict`, `actionError`.

- `SheetHeader className="pr-12"`:
  - `SheetTitle data-testid="sheet-rename-name"` wraps `InlineText` (from docket) `value=workflowLabel(w) label="Workflow name" className="text-lg font-semibold"` → `renameWorkflowName`.
  - `SheetDescription.flex.flex-col.gap-1`: `div[data-testid="sheet-rename-id"]` with `InlineText value=id label="Workflow id" className="text-xs font-mono"`; save → `newId = slugify(next).slice(0,40) || id`; skip if same; `renameWorkflowId`; on ok `onRenamedId(newId)`. Then **Solves: <goal>** when goal set.
  - outline link Button `workflow-open-editor` (`mt-2 w-fit`, icon `Workflow`) **Open editor** → `/workflows/<id>`.
- Body `flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t p-4`:
  - Alert `sheet-action-error`: **Conflict** / **This workflow changed elsewhere. Close and try again.** or **Could not update** / message. A later `"ok"` clears both.
  - `section[data-testid="sheet-inputs"]` (`flex flex-col gap-2`): `h3.text-sm.font-medium` **Inputs a card supplies**; with a trigger node → `TriggerInputs inputs onChange → saveWorkflowInputs(trigger.id)`; else `Badge outline` **No trigger**.
  - `WorkflowSheetRuns`.
- Footer `WorkflowSheetStart`. Start: `startRun({workflowId, cardId})`; ok → `onClose()` and navigate `/workflows/<id>?run=<runId>`.

### TriggerInputs (`canvas/TriggerInputs.tsx`)

Props `inputs: WorkflowInputDecl[], onChange`. `div.flex.flex-col.gap-2 data-testid="trigger-inputs"`:

- Chips row `flex flex-wrap gap-1.5`: none → `span.text-sm.text-muted-foreground` **No inputs yet**; else `Badge outline` per input with name and a `button aria-label="Remove <name>" data-testid="trigger-input-remove-<name>"` (`X size-3`).
- Add row `flex gap-2`: `Input aria-label="New input" placeholder="Input name, e.g. ticket" data-testid="trigger-input-draft"` (Enter adds), outline icon Button `trigger-input-add` **Add input** (`Plus`). Adds `{ name, type: "text", required: true }` when non-empty and unique; always clears draft.

### WorkflowSheetRuns

Props `workflowId, runs, cards`. Groups runs by `cardId ?? "_none"` keeping first-seen order.
`section.flex.flex-col.gap-3.border-t.pt-4`:

- `h3.text-sm.font-medium` **Runs by card** + muted `<N> cards · <M> runs`.
- Empty `p[data-testid="sheet-runs-empty"]` **No runs yet**.
- Else `div[data-testid="sheet-runs-list"]`; per group a `text-sm font-medium` heading (card title, **No card** for `_none`, or raw id) and per run a `Link` to `/workflows/<workflowId>?run=<runId>` (`-mx-2 flex min-h-8 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted`, `data-testid="sheet-run-row-<id>"`): `#<n>` (`w-6 text-xs muted tabular-nums`, numbered newest = highest within the group), `StatusPill`, muted `done/total · <RelativeTime>`.

### WorkflowSheetStart

`div.flex.items-center.gap-2.border-t.p-4`: card `Select` (trigger `min-w-0 flex-1`, `data-testid="sheet-start-card"`, placeholder **Run for a card…**) + Button `workflow-start` (`Play`) **Start run** (disabled without card or while pending).

## WorkflowEditorPage (`/workflows/:id`)

- `id` from `useParams`. Renders `<Editor key={id} id={id}>` (gate pattern as elsewhere). The key remounts per workflow.
- `Editor`: query `workflow/get {id}` topics `["workflow"]`.
  - Loading: `<Page fill crumbs=[{label:"Workflows", to:"/workflows"}, {label:id}] data-testid="workflow-editor">`, `PageTitle title=id description="Loading workflow…"`, `div.space-y-3 data-testid="workflow-editor-loading"` with `Skeleton h-8 w-48` + `h-80 w-full`.
  - Error / no data: description **Could not load workflow.**; Alert `workflow-editor-error` **Error** + message or **Not found**.
  - Else `EditorReady`.

### EditorReady state

| State                                                            | Meaning                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| URL `?run=<runId>`                                               | `runView` (default `"draft"`). `setRunView("draft")` deletes `run`; else sets it; uses `setParams(p, { replace: true })` |
| `draft: string \| null`                                          | YAML edits (null = saved file)                                                                                           |
| `hash: string \| null`                                           | Latest saved hash (null = detail.hash)                                                                                   |
| `layoutDraft`, `layoutSaved`                                     | `LayoutFile \| null`                                                                                                     |
| `conflict`, `saveError`, `validationErrors: string[]`, `pending` | Save feedback                                                                                                            |

Derived: `yaml = draft ?? detail.yaml`; `baseHash = hash ?? detail.hash`;
`baselineLayout = layoutSaved ?? detail.layout ?? { version: 1, nodes: {} }`;
`layout = layoutDraft ?? baselineLayout`;
`yamlDirty = draft !== null && draft !== detail.yaml`;
`layoutDirty = layoutDraft !== null && JSON(layoutDraft) !== JSON(baselineLayout)`;
`title = workflowLabel({ id, name: detail.workflow?.name })`;
`localParsed = parseNodeWorkflowYaml(yaml)` (memo; `{ workflow: Workflow | null, errors: {message}[] }`).
History: `useEditorHistory(yaml, layout, applySnapshot, true)` where applySnapshot sets `draft` and `layoutDraft`.

Save: clears feedback, `saveEditor(...)`; validation → list; conflict → flag;
error → message; ok with hash → `draft = yaml`, `hash = result.hash`; ok
with layout → `layoutSaved = layout`, `layoutDraft = null`.

Alert kind precedence: validation > conflict > error. Bodies: validation
messages joined with `·`; conflict **The file changed on disk. Reload or copy your edits, then try again.**; error message.

`canvasKey = "<id>:<detail.hash>"` (canvas remounts when the server file changes).

### EditorChrome

Props: `id, title, yaml, layout, parsed: Workflow|null, parseError?, canvasKey, dirty, pending, history {undo, redo, canUndo, canRedo}, alertKind, alertBody, runView, onRunView, onYamlChange, onLayoutChange, onSave`.

- `<Page fill crumbs=[{label:"Workflows", to:"/workflows"}, {label:title}] data-testid="workflow-editor">`.
- Header action: Button `workflow-editor-save` **Save** / **Saving…**, disabled when `!dirty || pending`.
- `PageTitle title description="Edit the node canvas or YAML. Save writes workflow.yaml and layout."`
- Alert (destructive), `data-testid` `workflow-editor-validation` for validation else `workflow-editor-conflict`; title **Invalid workflow** / **Conflict** / **Could not save**.
- `Tabs defaultValue="canvas" className="flex min-h-0 flex-1 flex-col"`:
  - `TabsList`: **Canvas** (`workflow-editor-tab-canvas`), **YAML** (`workflow-editor-tab-yaml`).
  - Canvas content (`mt-3 flex min-h-0 flex-1 flex-col data-[hidden]:hidden`): `WorkflowCanvas key=canvasKey` when parsed; else non-destructive Alert `workflow-canvas-invalid` **Invalid workflow** / **Fix the YAML tab so the canvas can render nodes.** + ` <parseError>`.
  - YAML content: plain `Textarea` (not CodeMirror) `min-h-0 flex-1 text-sm font-mono`, `data-testid="workflow-editor-yaml"`, `onChange → onYamlChange`.

Note: CodeMirror packages (`@uiw/react-codemirror`, `@codemirror/*`) and
`shiki` are declared dependencies of `apps/web` but no file under
`apps/web/src` imports them; the YAML tab is a Textarea. A rebuild may keep
the dependencies for parity or drop them.

### Keyboard shortcuts in the editor

| Keys                         | Effect                                         | Where                                                          |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Cmd/Ctrl+Z                   | Undo (yaml + layout snapshot)                  | `useEditorHistory` (ignored in input/textarea/contenteditable) |
| Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y | Redo                                           | same                                                           |
| Cmd/Ctrl+D                   | Duplicate selected nodes                       | `useCanvasKeys` (draft view only)                              |
| Backspace / Delete           | Delete selected wires and nodes (trigger kept) | `useCanvasKeys`                                                |
| `d`                          | Toggle light/dark (global)                     | ThemeProvider                                                  |
