---
id: BL-063
title: "Run view: one task list, auto-select, task detail"
type: backlog
status: done
summary: One task Table, failed or waiting task preselected, task header actions, detail Tabs filling the height, styled SUMMARY.md.
tags: [ui, web, runs, ai-elements]
related: [DES-029, DES-009]
updated: 2026-11-22
priority: P1
depends: [BL-062]
---

# Run view: one task list, auto-select, task detail

Design: [DES-029](../designs/des-029-ui-renovation-run-screens.md) (Run
view: Tasks tab, Auto-select, Task detail, SUMMARY.md). Fixes S10, S14,
#31.

## Done when

- [x] Tasks tab is a horizontal `ResizablePanelGroup`: task Table at 35%
      (min 25%), detail on the right; the Plan beside the Table is gone.
- [x] List or Graph is a default `Tabs` switch in the tab toolbar.
- [x] A failed run opens its first failed task on Terminal; a waiting
      run opens the waiting task on Output; else the running task, else
      the last finished one. The selection stays a search param.
- [x] Task detail has no Card: a row with the name
      (`h2 font-heading text-base`), status Badge and Retry, Approve,
      Reject or Promote at default size, then Tabs Output, Terminal,
      Attempts, Environment.
- [x] Terminal fills the remaining height (`min-h-0 flex-1`); Attempts
      logs use `max-h-64`.
- [x] SUMMARY.md maps h1 to `font-heading text-xl font-medium`, h2 to
      `font-heading text-base font-medium`, tables to shadcn `Table`,
      code to `CodeBlock size="sm"`.

## Notes

- BL-062 already landed the resizable split, one Table and auto-select; this
  item swapped the List or Graph `ToggleGroup` for default `Tabs`.
- `TaskDetail` lost its Card: h2 row, `TaskStatusBadge`, Promote and Retry.
  Approve and Reject stay in the run lead (Confirmation pattern).
- `Terminal` takes `fill` so the Terminal tab uses the remaining height.
- `SummaryMarkdown` maps headings, paragraphs, lists and tables to design
  tokens and shadcn `Table`; the `prose` classes are gone.
