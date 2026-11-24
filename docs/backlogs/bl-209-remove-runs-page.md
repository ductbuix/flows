---
id: BL-209
title: "Remove the Runs page"
type: backlog
status: done
summary: Delete /runs and pages/runs list; run detail opens in context only.
tags: [web, runs, cleanup]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-200, BL-203]
---

# Remove the Runs page

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Remove the route, sidebar entry, `RunsPage`, `RunsList` and `RunStartDialog`. Keep `RunSheet` for card and workflow. Update e2e and layout baselines.

## Done when

- [x] `/runs` is not a route and not in the sidebar.
- [x] Runs are reachable from a card and from a workflow.
- [x] `pnpm test:e2e` passes.
