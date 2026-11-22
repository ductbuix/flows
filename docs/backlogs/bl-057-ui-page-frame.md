---
id: BL-057
title: "UI frame: one page template from dashboard-01"
type: backlog
status: done
summary: Page, PageHeader, PageTitle, PageSection and PageToolbar from dashboard-01; every page uses them with a title and 24px rhythm.
tags: [ui, web, layout, shadcn]
related: [DES-027, DES-028, DES-029]
updated: 2026-11-22
priority: P0
depends: []
---

# UI frame: one page template from dashboard-01

Design: [DES-027](../designs/des-027-ui-renovation.md) (Page frame, Spec
sheet: Frame and type). Fixes S1 to S4.

## Done when

- [x] `apps/web/src/components/page/` holds `Page`, `PageHeader`,
      `PageTitle`, `PageSection` and `PageToolbar`; the old
      `PageHeader`, `PageTitle` and `Section` are removed.
- [x] Header is 48px (`--header-height: calc(var(--spacing) * 12)`),
      inner `px-4 lg:px-6`, `SidebarTrigger className="-ml-1"`, vertical
      `Separator className="mx-2 h-4 data-vertical:self-auto"`, actions
      in `ml-auto flex items-center gap-2`.
- [x] Content is
      `@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6`,
      each section `px-4 lg:px-6`; full-bleed regions carry `data-bleed`
      and no `px`.
- [x] All 13 routes use the template: at 1440x900 every h1 starts at
      x280, content top padding is 24px and section gaps are 24px.
- [x] Every page has an h1 (`font-heading text-xl font-medium`),
      including Editor, Workflow runs, Run view and empty Home; the
      workflow Tabs sit under the title.
- [x] `Page fill` gives Editor and Run view a last region that takes the
      remaining height with `min-h-0 flex-1`; no `calc()` heights
      remain.
- [x] Section header rows are `min-h-8` (32px) with or without a
      toolbar.
- [x] Evidence: waived by pootato (no video or screenshots).
- [x] `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass; lint
      errors that predate this change are waived.
