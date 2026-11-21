---
id: BL-040
title: Work items list and work item page
type: backlog
status: todo
summary: Sidebar entry, a searchable Work items Table, a new work item dialog, and a page with Runs, a Start card and Notes.
tags: [ui, web, work-items]
related: [DES-025, DES-026]
updated: 2026-11-22
priority: P1
depends: [BL-031, BL-034, BL-038, BL-039]
---

# Work items list and work item page

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (J1, J2, Pages: Work items, Work item). The
Context section shows an `Empty` until library links exist (BL-046).
The label is "Work items" everywhere, with no short form.

## Done when

- [ ] Sidebar Platform group gets "Work items" between Home and
      Workflows.
- [ ] `/work-items`: search and a Table (title, source Badge "Ad hoc",
      workflow, last run `RunStatusBadge`). A "New work item" Dialog
      takes title, optional workflow and notes.
- [ ] `/work-items/:id`: PageTitle with source Badge; Runs (Table
      filtered by `workItemId`); a Start card (workflow Select,
      declared inputs prefilled from the work item and editable, and
      the existing trust gate);
      Notes (Textarea, save with hash); Attachments as an `Item` list.
- [ ] Starting from the work item page sends `workItemId`; the new run
      appears in its Runs live.
- [ ] e2e covers J2: create, start a run, see it listed, edit notes.
      Screenshots in light and dark.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
