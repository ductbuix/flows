---
id: DES-029
title: "UI renovation: runs, run view, connections, settings, dialogs"
type: ui
status: draft
summary: Region layout with exact sizes for run lists, the run view (summary first), connections, library, settings and every dialog.
tags: [ui, web, ux, runs, connections, settings, layout]
related:
  [
    DES-009,
    DES-011,
    DES-019,
    DES-025,
    DES-027,
    DES-028,
    DES-030,
    BL-062,
    BL-063,
    BL-064,
    BL-070,
    BL-071,
    BL-073,
  ]
updated: 2026-11-22
---

# UI renovation: runs, run view, connections, settings, dialogs

Same frame, sizes and citations as
[DES-028](des-028-ui-renovation-screens.md); rules in
[DES-027](des-027-ui-renovation.md).

## Workflow Runs tab and Runs page

```
| Runs                                                              |
| Runs / Every run, grouped by work item.                           |
| [Workflow v] 192  [Status v] 192                                  |
| Fix login timeout                         group row, 37           |
|  Run | Workflow | Status | Started | Took | (actions)  rows 37    |
```

- Filters are two `Select`s with `w-48` (192px); today 176 and 208px
  (#25). They sit in a `PageToolbar`.
- Group rows are a `TableRow` with one `TableCell colSpan` in
  `bg-muted/50 font-medium`, 37px like any row.
- The Run column shows the readable run label (below); Started is a
  relative time with the absolute local time in a `Tooltip`.
- The workflow Runs tab is the same Table without the group rows and
  the Workflow column. Its rows are 45px today (S7); the row menu
  button in a `py-0` cell makes them 37px.

**Readable run label:** the work item title when the run has one,
otherwise "Ad hoc run". The workflow label and relative time follow as
secondary text. The run id is an `IdText` (first 8 characters, copy
button, full id in a `Tooltip`).

## Run view

Summary first, then tasks. `Page fill`.

```
| Runs > Fix login timeout                     [Cancel] [Rerun] [...] |
| Fix login timeout [Failed]                                          |
| Feature spec · started 3 min ago · took 1m 12s · 5ed1f86a (mono)   |
| ! Review spec failed on attempt 2 of 3.        [Open Terminal]  lead |
| [Tasks 3 of 5] [Duration] [Work item] [Inputs]   Cards sm, 88 tall  |
| [Tasks] [Changes 2] [Library pins 1]                    Tabs line   |
| task Table 35%            | Review spec [Failed]  [Retry]          |
|  Task | State | Tries | Took | [Output][Terminal][Attempts][Env]   |
|  rows 37                  | Terminal, fills the height             |
```

- **Header actions** by state: live runs show Cancel (`outline`) and
  More; finished runs show Rerun (default) and More (Delete run). Cancel
  on a finished run goes (#26).
- **Title block:** the run label as h1, run status `Badge`, then the
  workflow label, relative start, duration and `IdText`. The breadcrumb
  shows the label, not the UUID (S3, S11).
- **Lead**, only when needed: the Confirmation pattern when a task waits
  for approval, or `Alert variant="destructive"` naming the failed task
  and attempt with an "Open Terminal" `Button` (`outline`, 32px).
- **Summary cards:** `grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4` of `Card size="sm"` (272px each): `CardDescription`
  label, `CardTitle` value in `text-2xl font-semibold tabular-nums` as in
  dashboard-01 SectionCards. Tasks card adds `Progress` (4px). Inputs card
  lists `Attachment` chips or "None".
- **Tabs line:** Tasks, Changes (count `Badge`), Library pins (count).
  Effects, Changes to publish, unpublished diffs and Library pins move
  out of the page flow into these tabs, so empty ones no longer take
  about 250px above the tasks (S8, #26). An empty tab shows a section
  `Empty`.
- **Where tasks start:** 48 header + 24 + 52 title + 24 + 88 cards + 24
  - 40 tabs = y300, leaving 576px at 900px tall (today y516 and 369px).
    A lead Alert (60px plus a 24px gap) moves them to y384 (492px).
- **Tasks tab:** `ResizablePanelGroup` horizontal, left panel default
  35% (min 25%), right panel the task detail. One task list: the Table.
  The Plan beside it goes (S14). List or Graph is a default `Tabs`
  switch at the right of the tab's toolbar; "ws: open" goes. When the
  socket drops, a secondary `Badge` "Reconnecting" appears by the
  status Badge (S16).
- **Auto-select:** a failed run selects its first failed task on the
  Terminal tab; a waiting run selects the waiting task on Output;
  otherwise the running task, else the last finished one. Today nothing
  is selected (#31).
- **Task detail:** a row with the task name (`h2 font-heading text-base`),
  status `Badge`, and actions (Retry, Approve, Reject, Promote) at the
  right, default size. Then `Tabs variant="line"`: Output (SUMMARY.md
  and File Tree), Terminal (Terminal pattern, `CodeBlock size="sm"`
  filling the height), Attempts (per attempt Task trace with Plan and
  Stack Trace, `max-h-64` logs), Environment (env Items and the CLI
  command in a `CodeBlock`). No Card around it, so no card in a card.
- **SUMMARY.md** renders through react-markdown with mapped parts: h1
  `font-heading text-xl font-medium`, h2 `font-heading text-base font-medium`, h3 `text-sm font-medium`, p and lists `text-sm`, tables
  as shadcn `Table` in the wrapper, code blocks as `CodeBlock size="sm"`
  (S10).

## Connections and Library

```
| Connections                                     [Add connection] |
| Connections / Systems your tasks read from and publish to.       |
| [Connections] [Library]                         Tabs line        |
| Name | Kind | Policy | Sign-in | Used by | (actions)   rows 37   |
```

- "Add connection" in the header at 32px (today 28px, #37).
- The three-step explainer shows inside the `Empty` when there are no
  connections; with connections it moves to the `PageTitle` description
  and a "How it works" `Button variant="link"`.
- **Library tab:** Table of Entity, Connection, Revision (`IdText` with
  a `HoverCard` for the full revision and pull time), Freshness `Badge`,
  Pinned by. Row menu: New work item, Pull now, separator, Clear unused.
  Rows no longer wrap to 53 or 81px (S7, #39).

## Connection page

```
| Connections > jira-acme                       [Check again]     |
| Acme Jira [Approve each publish]                                 |
| Jira · jira-acme (mono)                                          |
| Sign-in      (Card)            | Publish policy   (Card)          |
| Refresh rule (Card)            | Local data       (Card)          |
| Used by      (Card, Items)                                       |
```

- Grid `grid grid-cols-1 gap-4 @3xl/main:grid-cols-2` of `Card`s (560px
  each); today one narrow column in 1136px (#40).
- Each Card: `CardHeader` (title, description), `CardContent` with the
  Field or facts, and `CardFooter` (`border-t bg-muted/50`) holding its
  action at the right (`ml-auto`), default size.
- Used by lists workflows and tasks as `Item size="xs"` rows with
  readable labels, not a mono list.

## Settings

```
| Settings                                                         |
| Settings / Appearance, agent CLIs and what Flows may run.        |
| Appearance     (Card)          | Agent CLIs      (Card, Items)   |
| Allowed MCP servers (Card)     | Keyboard shortcuts (Card, Kbd)  |
```

- Same two-column Card grid (560px each); today a 576px left column
  with an empty right side (#41).
- Appearance: theme `ToggleGroup` (Light, Dark, System), default size.
- Agent CLIs: one `Item size="sm"` per CLI with version as description,
  a `Badge` "Always allowed" or "Asks before each run", and
  `ItemActions` Allow or Revoke (`sm`). Trust can now be granted here,
  not only in the start flow (J-f).
- Allowed MCP servers: Items with "Allowed 3 days ago" and Revoke.
- Keyboard shortcuts: `ItemGroup` of `Item size="xs"` with `Kbd`, as in
  the shadcn shortcuts card: ⌘B sidebar, D theme, ⌘S save, ⌘Z undo, ⇧⌘Z
  redo, Esc close.

## Dialogs

Widths per kind from the spec sheet. Footers are `DialogFooter`
(`border-t bg-muted/50 p-4`), default-size buttons, Cancel (`outline`)
before the primary; a destructive extra action goes left with `mr-auto`.

| Dialog              | Kind   | Width | Content                                                                                  | Was (#)      |
| ------------------- | ------ | ----- | ---------------------------------------------------------------------------------------- | ------------ |
| Create workflow     | form   | 448   | Name first; folder id filled from it (mono, editable); Goal                              | 512 (08)     |
| Rename workflow     | form   | 448   | `Dialog`, not AlertDialog; Name (label only), then folder id; live runs block an id move | 384x470 (09) |
| Delete workflow     | delete | 384   | `AlertDialog`, type the name to confirm                                                  | 384 (10)     |
| New work item       | form   | 448   | Title, Source, Workflow `Combobox` with "Create workflow" as the last option             | 512 (04)     |
| Start run           | form   | 448   | Work item or Workflow `Combobox`, inputs in `ScrollArea` `max-h-96`, `Attachment` files  | 512 (23)     |
| Allow agent CLI     | form   | 448   | Plain copy, `Collapsible` "Technical checks" with a `CodeBlock size="sm"`                | 512x515 (24) |
| Add connection      | form   | 448   | Five Fields in one `FieldGroup`                                                          | 512 (38)     |
| Edit input          | form   | 448   | Name, Type, Required `Checkbox`, Default                                                 | new          |
| Conflict, collision | form   | 448   | Keep mine, Use disk; Rename                                                              | 384 (bug)    |
| Allow MCP server    | form   | 448   | Same layout as Allow agent CLI                                                           | 512          |
| Edit memory file    | editor | 576   | Title plain, path mono in the description, `Textarea`; Remove left                       | 672 (16)     |
| Edit prompt         | editor | 576   | Title "Edit prompt", task and path in description, Prompt Input; Save in footer          | 672 (17)     |
| Delete task         | delete | 384   | `AlertDialog`                                                                            | 384 (18)     |

**Start run** is one dialog everywhere (work item page, workflow
header, workflow Runs tab), replacing the Overview Start card, the Work
item Start card and `StartRunForm` (S14). Start shows a `Spinner` while
the pre-run check runs (about 2s today with only a disabled button).
The native file input becomes `Attachment` chips (S15).

**Allow agent CLI** replaces the trust dialog copy (S16):

- Title "Allow Cursor to run on this Mac?"
- Description "Cursor runs your agent tasks. It can change files only in
  this workflow's folder."
- Footer: Cancel (`outline`), Always allow (`outline`), Allow and start
  (primary). The full-width "Always trust" goes; the safest choice is
  the primary one.
- "Technical checks" (closed by default) holds the check list,
  FLOWAPP_HOME, the sandbox path and the CLI flags, for developers.
