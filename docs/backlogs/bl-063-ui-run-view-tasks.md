---
id: BL-063
title: "Run view: one task list, auto-select, task detail"
type: backlog
status: todo
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

- [ ] Tasks tab is a horizontal `ResizablePanelGroup`: task Table at 35%
      (min 25%), detail on the right; the Plan beside the Table is gone.
- [ ] List or Graph is a default `Tabs` switch in the tab toolbar.
- [ ] A failed run opens its first failed task on Terminal; a waiting
      run opens the waiting task on Output; else the running task, else
      the last finished one. The selection stays a search param.
- [ ] Task detail has no Card: a row with the name
      (`h2 font-heading text-base`), status Badge and Retry, Approve,
      Reject or Promote at default size, then Tabs Output, Terminal,
      Attempts, Environment.
- [ ] Terminal fills the remaining height (`min-h-0 flex-1`); Attempts
      logs use `max-h-64`.
- [ ] SUMMARY.md maps h1 to `font-heading text-xl font-medium`, h2 to
      `font-heading text-base font-medium`, tables to shadcn `Table`,
      code to `CodeBlock size="sm"`.
- [ ] Evidence: Playwright video plus light and dark screenshots at
      1440x900 of a failed run opening on Terminal, retry, and a
      SUMMARY.md with a table, attached to the PR.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
