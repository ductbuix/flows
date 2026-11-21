---
id: BL-041
title: Start card asks for the work item; runs grouped by work item
type: backlog
status: done
summary: Workflow Start card picks a work item or None, ad hoc, and prefills inputs; Runs and Home group and show runs by work item.
tags: [ui, web, work-items, runs]
related: [DES-025]
updated: 2026-11-22
priority: P1
depends: [BL-037, BL-040]
---

# Start card asks for the work item; runs grouped by work item

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (J3, Resolved questions: Start card inputs).

## Done when

- [x] The Overview Start card begins with a work item Select (search,
      "None, ad hoc" first). Picking one prefills declared inputs from
      its `inputs`; edits apply to this run only.
- [x] Runs groups by work item title ("Ad hoc" for none) instead of
      item key.
- [x] On a first launch with a workflow but no work item, Home's
      `Empty` offers one action, "New work item" (J1).
- [x] Home gets a "Work items" section: items with a live or recent
      run, newest first.
- [x] e2e covers J3: one workflow started for two work items, grouped
      on Runs.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
