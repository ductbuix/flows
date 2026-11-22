---
id: DES-028
title: "UI renovation: shell, home, work items, workflows, editor"
type: ui
status: draft
summary: Region layout with exact sizes for the shell, Home, work items, workflows, the editor, the task Sheet and workflow settings.
tags: [ui, web, ux, editor, work-items, layout]
related:
  [
    DES-010,
    DES-013,
    DES-025,
    DES-027,
    DES-029,
    DES-030,
    BL-065,
    BL-066,
    BL-067,
    BL-068,
    BL-069,
    BL-070,
    BL-073,
  ]
updated: 2026-11-22
---

# UI renovation: shell, home, work items, workflows, editor

Each screen uses the page frame and spec sheet in
[DES-027](des-027-ui-renovation.md); `S1` to `S16` and `#NN` cite the
scan table there. Sizes are at 1440x900 with the Sidebar open, so the
content column is 1184px wide and sections are 1136px. The run view,
lists of runs, connections, settings and dialogs are in
[DES-029](des-029-ui-renovation-run-screens.md).

## Shell and Sidebar

```
| Sidebar 256                    | header 48                       |
| [Flows]           row 32, p-2  |                                 |
| Platform          label 32     |                                 |
|  Home, Work items, Workflows,  |                                 |
|  Runs, Connections   rows 32   |                                 |
| Workflows      [+] label 32    |                                 |
|  Feature spec  [...]  rows 32  |                                 |
| (footer) Settings     row 32   |                                 |
```

- **Parts:** `Sidebar`, `SidebarHeader`, `SidebarGroup`,
  `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarMenuButton`,
  `SidebarMenuAction showOnHover` + `DropdownMenu` (Rename, separator,
  Delete `variant="destructive"`), from dashboard-01 `NavDocuments`.
- The header row is p-2 + 32 + p-2 = 48px, the same as the page header.
- Workflow rows show the readable label (`name`, else the humanized id)
  in Geist, not mono (S11). The id
  is in the row Tooltip.
- With no workflows, the group shows one `SidebarMenuButton` "Create
  workflow" with a `Plus` icon, not an `Empty` (S8).
- Replaces nothing; `AppSidebar`, `PlatformNav` and
  `WorkflowSidebarList` keep their roles.

## Home

```
| Home                                              [New work item] |
| Home / What needs you, what is running, and recent work.          |
| Needs you            (Items 66)    | Work items        [All]      |
| Running              (Items 66)    | Recent runs       [All]      |
```

- Grid `grid grid-cols-1 gap-6 @5xl/main:grid-cols-2`: two 556px
  columns. Left: Needs you, Running. Right: Work items, Recent runs.
- Each section is a `PageSection` whose header row is `min-h-8`, so it
  is 32px tall with or without a toolbar button. "All" is a
  `Button variant="ghost"` (32px) linking to the list page.
- Rows are `Item variant="outline" size="sm"`, 66px, five at most.
  Title is the readable run or work item label; description is one line
  such as "Succeeded · 3 min ago" (S11, S16). Status `Badge` sits in
  `ItemActions`.
- Running rows say "2 of 5 tasks" in the description instead of a
  `Progress` bar, so they stay 66px (today 72px, #02).
- Needs you rows are the Confirmation pattern: `ItemMedia variant="icon"`,
  title "Approve: Review spec", description with the run label and
  "waiting 5 min", `ItemActions` Reject (`outline`, `sm`) and Approve
  (`sm`).
- **First launch (#01):** a page `Empty` (no border, `flex-1`):
  `EmptyMedia variant="icon"` with `ClipboardList`, title "Start with a
  work item", description "A work item is the thing you want done, such
  as a ticket or a feature. Then pick a workflow to run on it.",
  actions New work item (default) and Create a workflow (`outline`).
  The header keeps the New work item action.
- Replaces: the `p-4` frame, raw UUID labels, ISO times.

## Work items

```
| Work items                                        [New work item] |
| Work items / Things you want done, and the runs on each.          |
| [Search work items........] 384                                   |
| Title | Source | Workflow | Last run | (actions)    rows 37       |
```

- "New work item" moves from the body to the header (S5).
- Search is an `InputGroup` with an `InputGroupAddon` search icon, in a
  `PageToolbar` with `max-w-sm` (384px).
- Table per the spec sheet: Source is an outline `Badge` with the system
  icon or secondary "Ad hoc"; Last run is a status `Badge` plus a
  relative time; row menu has Open, Start run, Delete.

## Work item page

```
| Work items > Fix login timeout                   [...] [Start run] |
| Fix login timeout [Rally]                                          |
| Opened from Rally · created 2 days ago · fix-login-timeout (mono)  |
| Runs           (Table)               | Notes        (Card)        |
| Context  [Add from library v] (Table)| Attachments  (Card)        |
```

- Grid `grid grid-cols-1 gap-6 @5xl/main:grid-cols-3`; the left column
  is `@5xl/main:col-span-2` (749px), the right one 363px.
- The Start card goes (S14). "Start run" in the header opens the one
  Start dialog with this work item filled in (DES-029).
- Context: the "Add from Library" Select plus Add button becomes one
  `Combobox` in the section toolbar; picking adds the entity.
- Notes: a `Card` with a `Textarea` and a `CardFooter` holding Save
  (default, `ml-auto`), not a full-width button (#05).
- Attachments: a `Card` with `Attachment` chips and an Add files button;
  empty shows a section `Empty`.

## Workflows

```
| Workflows                                      [Create workflow] |
| Workflows / Reusable sets of tasks.                              |
| [Search workflows.........] 384                                  |
| Name | Tasks | Last run | Runs | (actions)        rows 37        |
```

- Create workflow is on the page header (S14; today only the sidebar
  `+`). Rows alternate 37 and 38px today (S7); the `py-0` rule fixes it.
- Name is the readable label (`name` from `workflow.yaml`, else the
  humanized id, BL-073); the id shows in a `HoverCard` with copy.

## Workflow page (Overview, Editor, Runs)

```
| Workflows > Feature spec                              [Start run] |
| Feature spec                                                      |
| Draft a feature spec from a ticket. · feature-spec (mono, copy)   |
| [Overview] [Editor] [Runs]            Tabs line, h-8              |
```

- The title block comes first and the Tabs follow it (S3; today Tabs at
  y64 sit above the h1 at y120).
- "Start run" is in the header on every tab (S14).
- **Overview:** sections Tasks (Table: Task, Kind `Badge`, Connections,
  Needs), Connections and impact (Table, impact `Badge` in the section
  toolbar), Inputs (Table). Empty sections use a section `Empty`. The
  Start card below the fold goes (#07, #24).
- **Runs:** see DES-029.

## Editor

```
| title block + Tabs (as above)                                     |
| [Graph|YAML]           [undo][redo] [Settings] [Add task v] [Save] |
|-------------------------------------------------------------------|
| canvas, full bleed from x256 to x1440, fills the height           |
| [- + fit] bottom-left                                             |
```

- `Page fill`; the toolbar is a `PageToolbar` with `px-6`; the canvas
  and the YAML pane are both full bleed below a `border-t`, so they share
  one edge (S13).
- Toolbar, all 32px: view switch is default `Tabs` (Graph, YAML); Undo
  and Redo are `ghost` `icon` with Tooltips showing `Kbd`; "Workflow
  settings" `outline`; "Add task" `outline` with a `DropdownMenu`
  (Agent task, Command task, Publish task); Save default, disabled when
  clean, Tooltip "Save ⌘S". Header actions at 28px go (S5).
- New tasks get the kind picked in the menu, so an agent task needs no
  kind switch (J-b). A publish task opens the task Sheet with its
  connection Select first; the node is added once a connection is
  picked, so no invalid node appears (#19).
- Nodes are `Card size="sm"` with `w-56` (224px): name `text-sm font-medium`, then a row of `Badge`s (kind, connections, approval).
  Selected node: `ring-2 ring-ring`.
- `fitView` uses `maxZoom: 1` and `padding: 0.2`, so one task renders at
  100%, not 2.3x (S12, #21). Controls are a `ButtonGroup` of
  `icon-sm` buttons (graph is a dense container).
- YAML errors show as one `Alert variant="destructive"` in the toolbar
  row's place, above the canvas.
- The Inspector panel (497px, 1841px of content, #11) is removed; its
  content moves to two Sheets.

## Task Sheet

Opens on node click and on create. `SheetContent side="right"`, 384px.

```
| Draft spec                                         [x] | p-4
| Agent task · Cursor · draft-spec (mono)                |
|--------------------------------------------------------|
| Name           [Input 32]                              | px-4,
| Kind           [Select 32]   CLI [Select 32]  (2-up)   | FieldGroup
| Prompt         [Prompt Input, min 64]                  | gap-5
|                [Model v] [Effort v]            [open]  |
| Memory files   [Combobox chips]                        |
| Connections    (FieldSet, per connection Access)       |
| Behavior       Ask for approval first          [o-]    |
|                Can add tasks while running     [o-]    |
|--------------------------------------------------------|
| [Done]                                                 | p-4
| [Delete task]                                          |
```

- Body is a `FieldGroup` with `flex-1 overflow-y-auto px-4`. Kind and
  CLI are a two-up `grid grid-cols-2 gap-4` (168px each); command and
  publish tasks show Kind alone at full width (352px).
- Prompt is the Prompt Input pattern with Model Selector in its
  `InputGroupAddon align="block-end"` (dense container). "Open" is an
  `InputGroupButton` that opens the 576px prompt dialog. The 28px
  "Edit prompt" and the 121px menu triggers go (#12, S5).
- Memory files is a multiple `Combobox` with chips listing the
  workflow's memory files. Today `memory:` can only be set in YAML
  (J-b); this closes that gap.
- Behavior uses `Field orientation="horizontal"` with `Switch` at the
  right, so switches no longer float in the middle of a 467px field.
- Command tasks show Run as a `Textarea` (mono, it is a command).
- Footer: Done (default) and Delete task (`destructive`), stacked full
  width as `SheetFooter` lays them out. Esc and overlay click close;
  focus returns to the node.
- Edits go into the editor state like today; Save writes the workflow
  and prompt files.

## Workflow settings Sheet

Opens from "Workflow settings". Same Sheet and width.

- `Accordion` with `multiple`, first item open: Name, goal and limits (Name
  `Input`, Goal
  `Textarea`, Max concurrent runs `Input`), Inputs, Agent defaults (CLI
  `Select`, Model Selector), Memory files.
- Inputs are `ItemGroup` rows (`Item size="xs"`): name in mono, type
  `Badge`, Required as a `Checkbox` (S15). Clicking a row opens the
  input form dialog (448px). Today each input is a 467px Card (#11).
- Memory files are `Item size="xs"` rows with a row menu (Rename,
  Delete), then an `InputGroup` "notes.md" with an Add
  `InputGroupButton`, then Import .md (`outline`).
