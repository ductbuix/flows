---
id: DES-027
title: "UI renovation: rules and spec sheet"
type: ui
status: draft
summary: Renovation plan for UX, UI and DX on shadcn base-nova, blocks and AI Elements; one page frame and an exact spec sheet.
tags: [ui, web, ux, dx, shadcn, ai-elements, layout]
related:
  [
    DES-008,
    DES-009,
    DES-010,
    DES-016,
    DES-017,
    DES-024,
    DES-025,
    DES-028,
    DES-029,
    DES-030,
    BL-057,
    BL-058,
    BL-059,
    BL-060,
    BL-061,
    BL-073,
  ]
updated: 2026-11-22
---

# UI renovation: rules and spec sheet

Every page, journey and both kinds of developer experience get one
renovation pass, built only from shadcn components, blocks and AI
Elements. This doc holds the rules, the spec sheet and the page frame.
Screens are in [DES-028](des-028-ui-renovation-screens.md) and
[DES-029](des-029-ui-renovation-run-screens.md); journeys and DX are in
[DES-030](des-030-ui-renovation-journeys-dx.md). It builds on
[DES-024](des-024-ui-shadcn-baseline.md) and
[DES-025](des-025-journey-led-redesign.md) and replaces the parts listed
under "Supersedes".

## Decisions (pootato, 2026-11-22)

| Topic        | Decision                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| Source       | shadcn components, blocks and AI Elements; `base-nova` defaults are the only style source |
| DX           | Both: developers using Flows, and us building Flows                                       |
| First run    | Start from a work item, then pick or create a workflow                                    |
| Run view     | A run summary first, then the tasks                                                       |
| Editor       | Task settings open in a right `Sheet` over the graph; the graph keeps full width          |
| Control size | 32px default everywhere; small sizes only inside dense rows and tables                    |
| Labels       | Readable names and relative times first; ids only as secondary monospace text             |
| Order        | 1 frame, spacing, sizes; 2 run view; 3 editor; 4 home and lists; command palette later    |
| Kept         | One UI for every user, light theme by default, Playwright video and screenshots per UI BL |

## Principles

1. **Compose, never restyle.** A look comes from a component's
   `variant` and `size` props. App code adds only layout classes
   (`flex`, `grid`, `gap-*`, `p-*`, `min-h-0`, `flex-1`, `truncate`).
2. **One frame.** Every page is the dashboard-01 frame below. No page
   invents its own padding, gap or title.
3. **One value per job.** Each row of the spec sheet has exactly one
   value. A new need gets a new row, not a local override.
4. **Detail one step away.** Developer detail (YAML, ids, env, raw logs,
   CLI flags) lives in fixed places one click away, never in the main
   label (DES-030).
5. **Evidence.** Each UI backlog ships Playwright video plus light and
   dark screenshots at 1440x900, and the layout check in BL-061 passes.

## What the scan found

One scan of `develop` at `afc3035` (2026-11-22), 43 screens in light and
dark at 1440x900. Raw files stayed on the scanning machine. The numbers
below (S1 to S16) are cited by the screen docs; `#NN` is a screen number.

| Id  | Finding                                                                                     |
| --- | ------------------------------------------------------------------------------------------- |
| S1  | Page padding 16px on 6 pages, 24px on 7; the title jumps between x272 and x280              |
| S2  | Breadcrumb text starts at x321, content at x272 or x280; nothing lines up                   |
| S3  | No page title on Editor, Workflow runs, Run view, empty Home; Overview has Tabs above title |
| S4  | Section gap 24px on most pages, 16px on Run view, `space-y-4` on Workflow runs              |
| S5  | 107 of 198 buttons are 28px `sm` beside 32px inputs; header actions 28px or 32px            |
| S6  | Radii mixed in one row: 8px `sm` buttons next to 10px inputs                                |
| S7  | Table rows 37, 38 (Badge), 45 (row button), 53 and 81px (wrapping mono ids)                 |
| S8  | Empty states 99 to 224px with border in sections, borderless in the sidebar                 |
| S9  | Dialogs 384, 512 and 672px with no rule; Rename uses an AlertDialog 470px tall              |
| S10 | Mono dialog titles; SUMMARY.md `# Report` renders 14px/400                                  |
| S11 | Raw UUIDs and mono workflow ids as main labels                                              |
| S12 | Graph zoom 0.6x to 2.3x; node Badges 14px tall at 0.6x                                      |
| S13 | Graph full bleed at x256, YAML pane and tabs inset at x272                                  |
| S14 | Three Start UIs; Plan and task Table list the same tasks; three create entry points         |
| S15 | Native file input in Start; Switch used in dense input rows                                 |
| S16 | Jargon: "ws: open", FLOWAPP_HOME, `--force`, realpath, raw ISO UTC times, "pass" labels     |

## Spec sheet

Values at the 1440x900 test viewport. Sources: `R` is the built
base-nova registry item (`ui.shadcn.com/r/styles/base-nova/<name>.json`),
`REPO` is `shadcn-ui/ui` `apps/v4` at `bfa64ff`. "No class" means the
component default is used as is.

### Frame and type

| Element            | Rule                                                                            | px          | Source                                    | Fixes    |
| ------------------ | ------------------------------------------------------------------------------- | ----------- | ----------------------------------------- | -------- |
| Sidebar            | `Sidebar collapsible="offcanvas"`, default variant, width 16rem                 | 256         | R/sidebar `SIDEBAR_WIDTH`                 | -        |
| Sidebar header row | `SidebarHeader` p-2 with one `SidebarMenuButton` h-8                            | 48          | R/sidebar                                 | -        |
| Sidebar group      | `SidebarGroup` p-2, label h-8 `text-xs`, menu gap-0, button h-8 p-2 gap-2       | 32 rows     | R/sidebar                                 | -        |
| Page header        | `h-(--header-height)` with `--header-height: calc(var(--spacing) * 12)`         | 48          | R/dashboard-01 site-header, page          | S2       |
| Header inner       | `flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6`                          | 24 pad      | R/dashboard-01 site-header                | S1, S2   |
| Header trigger     | `SidebarTrigger className="-ml-1"` (`ghost`, `icon-sm`)                         | 28          | R/sidebar, R/dashboard-01                 | -        |
| Header separator   | `Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto"` | 16 tall     | R/dashboard-01 site-header                | -        |
| Header actions     | `ml-auto flex items-center gap-2`, Buttons default size                         | 32          | REPO new-york-v4 dashboard-01 site-header | S5       |
| Page content       | `@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6`              | 24 gap, pad | R/dashboard-01 page                       | S1, S4   |
| Section inset      | each section `px-4 lg:px-6`; full-bleed regions omit it                         | 24          | R/dashboard-01 page                       | S1, S13  |
| Page title         | `h1 font-heading text-xl font-medium` (Figtree 20/28)                           | 20          | DES-025 title block; R/login-03 `text-xl` | S3       |
| Title description  | `text-sm text-muted-foreground`, block `flex flex-col gap-1`                    | 14/20       | R/card description                        | -        |
| Section title      | `h2 font-heading text-base font-medium`, `gap-3` to content                     | 16/24, 12   | R/card title; DES-025 rule 2              | -        |
| Body               | `text-sm` (Geist 14/20)                                                         | 14          | all R items                               | -        |
| Meta text          | `text-xs text-muted-foreground`, numbers `tabular-nums`                         | 12/16       | R/dashboard-01                            | -        |
| Mono               | `font-mono text-xs` for ids, commands, paths, logs only                         | 12/16       | DES-025 rule 7                            | S10, S11 |

### Surfaces and controls

| Element            | Rule                                                                                               | px          | Source                         | Fixes  |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------- | ------------------------------ | ------ |
| Card               | no class; `--card-spacing` 4, `rounded-xl`, `ring-1 ring-foreground/10`                            | 16 pad, 14r | R/card                         | -      |
| Card in grids      | `Card size="sm"`; grid `grid grid-cols-1 gap-4 @xl/main:grid-cols-2`                               | 12 pad, 16  | R/card; R/dashboard-01         | -      |
| Item rows          | `ItemGroup` gap-4 (sm gap-2.5); `Item variant="outline" size="sm"`, one-line title and description | 66 tall     | R/item                         | -      |
| Form               | `FieldGroup` gap-5, `FieldSet` gap-4, `Field` gap-2, two-up `grid grid-cols-2 gap-4`               | 20/16/8     | R/field; R/dashboard-01 drawer | S15    |
| Button             | default `h-8 px-2.5 rounded-lg`, icon `size-8`                                                     | 32, 10r     | REPO style-nova.css 177-206    | S5, S6 |
| Dense button       | `sm` h-7 / `icon-sm` size-7 / `xs` h-6, only in dense containers (below)                           | 28/24       | same                           | S5     |
| Input, Select      | no class; `h-8 rounded-lg px-2.5`                                                                  | 32, 10r     | R/input, R/select              | -      |
| Textarea           | no class; `min-h-16 rounded-lg px-2.5 py-2`                                                        | 64 min      | R/textarea                     | -      |
| Switch, Checkbox   | Switch default (32x18.4, full radius) for settings; Checkbox `size-4`, 4px radius in rows          | 18/16       | R/switch, R/checkbox           | S15    |
| Badge              | no class; `h-5 rounded-4xl px-2 text-xs`, svg `size-3`                                             | 20          | R/badge                        | -      |
| Icons              | no size class inside components (`size-4`); `sm` buttons `size-3.5`                                | 16          | all R items                    | -      |
| Tabs (page)        | `Tabs variant="line"`, list h-8, under the page title                                              | 32          | R/tabs                         | S3     |
| Tabs (view switch) | default `Tabs` (segmented), list h-8                                                               | 32          | R/tabs                         | -      |
| Alert              | no class; `rounded-lg border px-2.5 py-2`                                                          | 10r         | R/alert                        | -      |
| Menu               | `DropdownMenuContent` no width class (`min-w-32`), item `rounded-md px-1.5 py-1`                   | 128 min, 8r | R/dropdown-menu                | -      |
| Tooltip            | no class; `rounded-md px-3 py-1.5 text-xs`, `Kbd` inside for shortcuts                             | 8r          | R/tooltip                      | -      |
| Hover card         | no class; `w-64 rounded-lg p-2.5`                                                                  | 256         | R/hover-card                   | S11    |
| Progress           | no class; `h-1 rounded-full`                                                                       | 4           | R/progress                     | -      |

### Tables, dialogs, sheets, empty states

| Element         | Rule                                                                                              | px           | Source                                                   | Fixes |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- | ----- |
| Table wrapper   | `overflow-hidden rounded-lg border`; header row `bg-muted`                                        | 10r          | R/dashboard-01 data-table                                | S7    |
| Table header    | `TableHead` no class (`h-10 px-2`)                                                                | 40 (+1)      | R/table                                                  | S7    |
| Table row       | `TableCell` `p-2`; cells that hold a Badge, Checkbox or button add `py-0`                         | 37 always    | R/table; this doc                                        | S7    |
| Row action      | `Button variant="ghost" size="icon-sm"` + `DropdownMenu align="end"`, last column                 | 28           | R/dashboard-01 data-table                                | S7    |
| Long cell text  | `truncate` inside `max-w-xs`; full text in `Tooltip`, ids in `HoverCard`                          | 320 max      | R/table `whitespace-nowrap`                              | S7    |
| Empty table     | no Table; an `Empty` with `border` in its place                                                   | -            | R/empty                                                  | S8    |
| Dialog, confirm | `DialogContent` no class (`sm:max-w-sm`), `p-4 gap-4 rounded-xl`                                  | 384          | R/dialog                                                 | S9    |
| Dialog, form    | `DialogContent className="sm:max-w-md"`                                                           | 448          | REPO examples/base/dialog-close-button.tsx               | S9    |
| Dialog, editor  | `DialogContent className="sm:max-w-xl"` (prompt, memory, file)                                    | 576          | REPO registry/bases/base/examples/code-block-example.tsx | S9    |
| Delete          | `AlertDialogContent` default size (`sm:max-w-sm`); only for deletes                               | 384          | R/alert-dialog                                           | S9    |
| Dialog title    | `DialogTitle` no class (`text-base font-medium`), never mono; paths go in the description as mono | 16           | R/dialog                                                 | S10   |
| Sheet           | `SheetContent side="right"` no class (`w-3/4 sm:max-w-sm`)                                        | 384          | R/sheet                                                  | -     |
| Sheet parts     | header `p-4 gap-0.5`; body `flex-1 overflow-y-auto px-4`; footer `p-4 gap-2`                      | 16           | R/sheet                                                  | -     |
| Empty, section  | `Empty className="border"` (`p-6 gap-4 rounded-xl border-dashed`), `EmptyMedia variant="icon"`    | 24 pad, 14r  | R/empty                                                  | S8    |
| Empty, page     | `Empty` without border, `flex-1`, centered                                                        | 24 pad       | R/empty                                                  | S8    |
| Empty action    | `EmptyContent` with default Buttons                                                               | 32           | R/empty; size decision                                   | S5    |
| Code block      | `CodeBlock size="sm"`; in a task tab it fills (`min-h-0 flex-1`), in lists `max-h-64`             | 12 text, 256 | R/code-block; REPO terminal                              | -     |

**Radii in use, and nothing else:** 4px Checkbox, 6px Kbd (`rounded-sm`),
8px menu items, tab triggers, Tooltip and dense buttons (`rounded-md`),
10px controls, Alert, Item, Table wrapper, Code Block, Popover and Hover
Card (`rounded-lg`), 14px Card, Dialog and Empty (`rounded-xl`), full for
Badge, Switch, Progress. Dense buttons (8px) never sit in a row with
10px inputs, which resolves S6.

**Dense containers** (the only places for `sm`, `xs`, `icon-sm`,
`icon-xs`): `TableCell`, `ItemActions`, `InputGroupAddon`, sidebar menus,
`CodeBlockHeader`, graph nodes, and the copy button of an id. Everywhere
else a control is 32px.

## Page frame

Derived from dashboard-01. One `Page` component owns the frame, so no
page sets its own padding.

```
| header 48: [trigger 28] | [Breadcrumb]              [actions h-8 gap-2] |
|---------------------------------------------------------------------------|
| content (py-6 gap-6)                                                      |
|  px-6 [h1 Title 20/28]  [Badge]                                            |
|  px-6 muted description 14/20 · id mono 12 (secondary)                    |
|  px-6 [Tabs line h-8]            (only on Workflow and Connections)       |
|  px-6 sections ... (gap-6), or a full-bleed region (no px)               |
```

- **Parts** in `apps/web/src/components/page/`: `Page` (the content
  stack), `PageHeader` (trigger, separator, `Breadcrumb`, actions),
  `PageTitle` (h1, optional Badge, description, optional `IdText`),
  `PageSection` (h2 plus `gap-3`), `PageToolbar` (one row of controls
  for a section or tab, `flex items-center gap-2`).
- **Alignment.** The h1, every section and the header padding edge all
  start at sidebar + 24px (x280). The trigger's box starts 4px left of
  it (`-ml-1`), so its 16px glyph sits at x282. The breadcrumb follows
  the separator, as in dashboard-01. This replaces today's x272, x280
  and x321 (S1, S2).
- **Title on every page** (S3). Pages with Tabs put them under the
  title. Full-height pages (Editor, Run view) use `Page fill`, which adds
  `min-h-0` and lets the last region take the rest of the height.
- **Actions.** Page actions go in the header, default size, primary
  last. Section actions go in a `PageToolbar` at the right of the h2.
- **Narrow widths.** Below 1024px padding and gaps drop to 16px (`px-4`,
  `gap-4`), as dashboard-01 does; below 768px the Sidebar becomes its
  sheet (`SIDEBAR_WIDTH_MOBILE` 18rem).

## shadcn components to add

All exist for base-nova (registry returned 200 for each on 2026-11-22).

| Component    | Command                                                        | For                                          |
| ------------ | -------------------------------------------------------------- | -------------------------------------------- |
| `popover`    | `pnpm dlx shadcn@latest add popover -c apps/web`               | Combobox, id details on click                |
| `combobox`   | `pnpm dlx shadcn@latest add combobox -c apps/web`              | Work item, workflow, memory, library pickers |
| `checkbox`   | `pnpm dlx shadcn@latest add checkbox -c apps/web`              | Booleans in dense rows (Required)            |
| `hover-card` | `pnpm dlx shadcn@latest add hover-card -c apps/web`            | Full id, revision and path details           |
| `accordion`  | `pnpm dlx shadcn@latest add accordion -c apps/web`             | Workflow settings sections                   |
| `command`    | `pnpm dlx shadcn@latest add command -c apps/web` (BL-072 only) | Command palette, later                       |

Run each with `--dry-run` first. Already installed and now used:
`sheet` (task and workflow settings), `attachment` (Start run files),
`toggle-group`, `kbd`. Not added: `pagination` (lists stay short),
`drawer`, `context-menu`.

## Supersedes

Marked in each doc with a link here rather than rewritten:

- DES-025 layout rule 1 (`p-6`), "Pages", and the Start card answer.
- DES-024 control sizes in "Divergence inventory" where they say `sm`.
- DES-009 and DES-010 layout of the run view and the Inspector.
- DES-008 "Screens".

## Resolved questions

1. **Developer details** (pootato, 2026-11-22): YAML, ids, env and raw
   logs stay in fixed tabs and places, with no Advanced switch. This
   keeps the DES-016 row of 2026-11-21 ("No Simple/Pro mode; detail
   lives in Tabs"). DES-030 lists where each detail lives.
2. **Workflow names** (pootato, 2026-11-22): `workflow.yaml` gets an
   optional top-level `name` (DES-002). The UI label is `name`, else the
   humanized folder id ("feature-spec" becomes "Feature spec"). The id
   stays the key and shows as secondary mono text. BL-073 adds it.

No open questions remain.

## Trade-off ledger

| Decision                                | Risk                                      | Guard                                      | Revisit when                                 |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| Default Sidebar variant, not inset      | Looks plainer than dashboard-01           | Same parts; `variant="inset"` is one prop  | pootato wants the inset card look            |
| Modal task Sheet over the graph         | Picking another node needs Esc first      | Esc and overlay click close; focus returns | users switch tasks often (try right Sidebar) |
| Sheet keeps 384px default width         | Long labels wrap; prompt box is narrow    | "Open in editor" opens the 576px dialog    | prompts are mostly edited in the dialog      |
| Humanized id when `name` is absent      | Two ids can humanize alike ("a-b", "a_b") | id shown secondary on every title          | users ask for a required `name`              |
| `py-0` on control cells for 37px rows   | One layout class on a shadcn part         | Lint allows only `py-0` on `TableCell`     | shadcn ships a dense table size              |
| Screenshot baselines per machine        | Font rendering differs across Macs        | 1% pixel tolerance, local-only app         | Flows gets CI                                |
| One Start dialog, no inline Start cards | One extra click on a work item page       | "Start run" is always in the header        | users ask for the inline card back           |

## Done when

Phases 19 to 23 in [DES-017](des-017-roadmap.md) are done: BL-057 to
BL-061 and BL-073 (frame, sizes, names, components, guards, workflow
name), BL-062 to BL-064 (run
view and Start), BL-065 to BL-067 (editor), BL-068 to BL-071 (home and
lists), then BL-072 (command palette).
