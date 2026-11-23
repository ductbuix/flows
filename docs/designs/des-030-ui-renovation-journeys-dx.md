---
id: DES-030
title: "UI renovation: journeys and developer experience"
type: ui
status: draft
summary: Journeys with click counts before and after the renovation, DX for people using Flows, and conventions, lint and checks for us.
tags: [ui, web, ux, dx, journeys, lint, testing, ai-elements]
related:
  [
    DES-008,
    DES-016,
    DES-024,
    DES-025,
    DES-027,
    DES-028,
    DES-029,
    BL-059,
    BL-060,
    BL-061,
    BL-072,
    BL-073,
  ]
updated: 2026-11-23
---

# UI renovation: journeys and developer experience

Rules and spec sheet: [DES-027](des-027-ui-renovation.md). Screens:
[DES-028](des-028-ui-renovation-screens.md) and
[DES-029](des-029-ui-renovation-run-screens.md).

## Journeys

Clicks count each press of a button, menu, option, row or tab, and ⌘S.
Typing and a first-time "Allow" are not counted. "Today" comes from the
scan summarized in DES-027 (`afc3035`).

| Journey                                              | Today                                                       | After                                                         | Clicks            |
| ---------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- | ----------------- |
| R1 First launch from a work item                     | Empty Home has no work item action                          | Home Empty, New work item, create a workflow inside it, Start | 10 to 7           |
| R2 Add an agent task (prompt, model, effort, memory) | Kind switch every time; memory only in YAML; ~1800px scroll | Add task, Agent task, fill the Sheet, ⌘S                      | 17+YAML to 11     |
| R3 Start a run on a work item                        | Start card below the fold, three different UIs              | Start run in the header, same dialog everywhere               | 3 to 4, no scroll |
| R4 See the summary, then the failed task             | No title; failed task not selected                          | Summary first; failed task open on Terminal                   | 3 to 2            |
| R5 Approve                                           | Home Needs you, or run Confirmation                         | Same; the waiting task's Output is already open               | 1 to 1            |
| R6 Retry a failed task                               | Select the task, then Retry on its Card                     | Failed task preselected; Retry in its header                  | 4 to 3            |
| R7 Settings and trust                                | Trust only granted inside Start; jargon                     | Allow or Revoke per CLI in Settings; plain copy               | 2 to 2            |

**R1 after:** Home Empty "New work item" (1), type a title, Workflow
combobox (2), "Create workflow" (3), type a name, Create workflow (4),
which returns to the form with it picked, Create (5), "Start run" on the
work item page (6), Start run (7). A first agent run adds "Allow and
start" (8). Today: Work items (1), New work item (2), Create (3),
sidebar `+` (4), Create (5), Work items (6), the item (7), workflow
Select (8), pick (9), Start (10), plus trust (11).

**R2 after:** Editor tab (1), Add task (2), Agent task (3), which opens
the Sheet with the workflow's default CLI, Prompt (4), Model (5) and a
model (6), Effort (7) and a level (8), Memory files (9) and a file (10),
⌘S (11). Today: 14 clicks for prompt, model and effort, 3 more to create
a memory file after scrolling the Inspector, and attaching it needs the
YAML tab.

**R3 after:** Start run (1), Work item combobox (2), the item (3), Start
run (4). One click more than today's Overview card (Select, item,
Start), but no scroll past about 680px, and the same dialog on the work
item page, the workflow header and the Runs tab (ledger in DES-027).

**R4 after:** Runs (1), the run (2). Title, status, summary cards and the
failed task's Terminal are already on screen; Attempts is one more
click, as today.

**Jargon removed:** the trust dialog copy and button order (DES-029,
Dialogs), "ws: open" (a "Reconnecting" Badge only when needed), raw ISO
UTC (relative times, absolute local time with zone in a Tooltip), "pass"
labels and FLOWAPP_HOME (inside "Technical checks"), `$TASK_OUT` (in the
Environment tab only).

## DX for people using Flows

No Advanced switch (pootato, 2026-11-22; DES-027 resolved question 1):
developer detail lives in fixed tabs and places, always one step away.

| Detail             | Where                                                        | Reach     |
| ------------------ | ------------------------------------------------------------ | --------- |
| YAML               | Editor view switch "YAML"                                    | 1 click   |
| Ids                | `IdText` after every title, copy button, full id in Tooltip  | 0, copy 1 |
| Revisions, paths   | `HoverCard` on the `IdText`; dialog descriptions             | hover     |
| Env vars           | Run view task tab Environment                                | 1 click   |
| Raw logs           | Task tab Terminal; Attempts per attempt                      | 0 or 1    |
| CLI command, flags | Environment tab `CodeBlock`; Allow dialog "Technical checks" | 1 click   |

- **`IdText`:** `font-mono text-xs text-muted-foreground`, UUIDs cut to
  8 characters, then a copy `Button variant="ghost" size="icon-xs"`
  (dense) with Tooltip "Copy id"; copying shows a `sonner` toast
  "Copied".
- **Times:** `RelativeTime` uses `Intl.RelativeTimeFormat`: "just now"
  under 45s, "3 min ago", "2 h ago", "yesterday", then a short local
  date ("Nov 14"). Tooltip: "Nov 22, 2026, 10:17 (GMT+7)". It refreshes
  every 30s. Durations read "1m 12s".
- **Shortcuts:** ⌘S saves in the editor, also inside CodeMirror and the
  Sheet (prevents the browser save); ⌘Z and ⇧⌘Z undo and redo; Delete
  removes the selected node; Esc closes a Sheet or Dialog; ⌘B toggles
  the Sidebar (shadcn); D toggles the theme outside inputs. Tooltips on
  those buttons show `Kbd`; Settings lists them all. ⌘K comes with the
  command palette (BL-072).
- **Focus order:** Sidebar, header (trigger, breadcrumb links, actions
  left to right), Tabs, toolbar, then content in reading order. A Sheet
  or Dialog traps focus, starts on its first field, submits on Enter,
  and returns focus to what opened it (the graph node for the task
  Sheet). shadcn's `focus-visible` ring is never removed.
- **Monospace** only for ids, commands, paths and logs, through
  `IdText`, `CodeBlock`, Terminal and the command `Textarea`.

## DX for us

### Folders

| Folder                                 | Holds                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/`          | shadcn generated files only; never edited by hand                                           |
| `apps/web/src/components/page/`        | `Page`, `PageHeader`, `PageTitle`, `PageSection`, `PageToolbar`                             |
| `apps/web/src/components/data/`        | `IdText`, `RelativeTime`, `Duration`, every status `Badge` mapping                          |
| `packages/ui/src/components/`          | shadcn parts and domain-free AI Element patterns (`Task`, `Suggestion`, …)                  |
| `apps/web/src/components/ai-elements/` | Flows-bound AI adaptations only (e.g. `ModelSelector` on shared types)                      |
| `apps/web/src/lib/labels.ts`           | `workflowLabel` (`name`, else humanized id), `runLabel`, `formatRelative`, `formatDuration` |
| `apps/web/src/pages/<area>/`           | home, work-items, workflows, editor, runs, run-view, connections, settings                  |

Each area backlog moves its own page files, so no big-bang move.

### AI Elements realigned to the registry

Each file starts with a comment naming its source in `shadcn-ui/ui`
(`apps/v4/examples/base/<file>`) and the commit. Only base-rhea demo
literals change, to base-nova values (for example `mx-6 mb-6` becomes
`mx-4 mb-4` to match `SheetHeader p-4`), and the comment lists them.

| File                        | Source                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `confirmation.tsx`          | `confirmation-demo.tsx`                                                                                                   |
| `plan.tsx`                  | `plan-demo.tsx`, `plan-description.tsx`                                                                                   |
| `task.tsx`                  | `task-demo.tsx`                                                                                                           |
| `stack-trace.tsx`           | `stack-trace-demo.tsx`, `stack-trace-frames.tsx`                                                                          |
| `terminal.tsx`              | `terminal-demo.tsx`, `terminal-error.tsx`                                                                                 |
| `file-tree.tsx`             | `file-tree-demo.tsx`                                                                                                      |
| `model-selector.tsx`        | `model-selector-demo.tsx`                                                                                                 |
| `prompt-input.tsx`          | `prompt-input-demo.tsx`                                                                                                   |
| `environment-variables.tsx` | not an AI Element: moves to `components/data/`, from `registry/bases/base/blocks/preview/cards/environment-variables.tsx` |

`trace` and `code-block` are re-added with `--overwrite`; the
`shimmer` and `scroll-fade-x` utilities they use must exist in the
installed `shadcn/dist/tailwind.css` (unchecked today).

### Lint guards

In `apps/web/eslint-tailwind-guard.js`, next to the three existing rules
(arbitrary values, palette colors, `h-`, `size-` and `rounded-` on
`@workspace/ui` parts):

1. **Dense sizes only in dense places.** `size` of `sm`, `xs`,
   `icon-sm` or `icon-xs` on an `@workspace/ui` part is an error unless
   a JSX ancestor is `TableCell`, `TableHead`, `ItemActions`,
   `InputGroupAddon`, a `Sidebar*` part or `CodeBlockHeader`, or the
   file is a graph node file, `IdText` or under `ai-elements/`.
2. **Dialog widths.** `DialogContent` may carry only `sm:max-w-md` or
   `sm:max-w-xl` as a width; `SheetContent` and `AlertDialogContent`
   carry none.
3. **Mono allowlist.** `font-mono` only in `components/data/`,
   `ai-elements/` and the command `Textarea` file.
4. **Frame padding.** `p-6`, `px-6`, `py-6`, `lg:px-6` and `md:py-6`
   only under `components/page/`; pages never render `main` or
   `header`.
5. **Times.** `toISOString`, `toLocaleString` and `toLocaleDateString`
   calls are errors under `pages/`; use `RelativeTime`.

### Layout check

`apps/e2e/tests/layout.spec.ts` visits every route in light and dark at
1440x900 and asserts:

- header 48px; one h1 at x280 with a 20px font; content top padding 24px;
- every section left edge at x280, except regions marked `data-bleed`;
- every `[data-slot=button]`, `[data-slot=input]` and
  `[data-slot=select-trigger]` outside the dense containers above is
  32px tall;
- every body `[data-slot=table-row]` is 37px and header rows 41px;
- each dialog kind measures 384, 448 or 576px wide;
- `toHaveScreenshot("<route>-<theme>.png", { maxDiffPixelRatio: 0.01 })`
  against committed baselines.

### Adding a component

1. Check `packages/ui/src/components`, then shadcn components, then AI
   Elements (DES-008 order).
2. `pnpm dlx shadcn@latest add <name> -c apps/web --dry-run`, then
   without `--dry-run`. Never edit the generated file; to update, re-run
   with `--overwrite` and review the diff.
3. For an AI Element, copy the Base UI example into
   `packages/ui/src/components/` when domain-free (source comment); put
   Flows-bound adaptations under `apps/web/.../ai-elements/`.
4. Add it to `/dev/kit` in light and dark, and to the layout check if it
   is a control.
