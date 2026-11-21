---
id: BL-034
title: Sidebar Platform group, Workflows and Runs pages
type: backlog
status: done
summary: Sidebar gets a Platform group (Home, Workflows, Runs); Workflows is a searchable Table with last run; Runs is a Table grouped by item key.
tags: [ui, web, sidebar, runs]
related: [DES-025, DES-024]
updated: 2026-11-22
priority: P0
depends: [BL-031, BL-032, BL-033]
---

# Sidebar Platform group, Workflows and Runs pages

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (Shell and navigation, Pages). Runs group by
`itemKey` for now; BL-041 switches the grouping to work items. The
existing "Workflows" sidebar group with its create action stays.

## Done when

- [x] Sidebar group "Platform" lists Home, Workflows and Runs with
      active state; Settings stays in the footer.
- [x] `/workflows` shows a search Input and a Table (name, task count,
      last run `RunStatusBadge`, last run time). A row opens
      `/workflows/:id`.
- [x] `/runs` shows one Table of runs from `GET /runs`, grouped by
      item key (runs without one under "No item"), with status and
      workflow filters. A row opens `/runs/:runId`. Updates live from
      `runs_changed`.
- [x] Both pages use `PageTitle`, `Empty` when there is nothing, and
      `Skeleton` while loading.
- [x] Playwright screenshots both pages in light and dark, including
      empty states.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
