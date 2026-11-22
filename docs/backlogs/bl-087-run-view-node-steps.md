---
id: BL-087
title: "Run view: step table and frozen graph"
type: backlog
status: todo
summary: Behind the flag, the run view lists node steps (one row per pass) and its graph tab uses the run's frozen layout.
tags: [web, run-view, nodes]
related: [DES-036, DES-029]
updated: 2026-11-22
priority: P0
depends: [BL-093, BL-078]
---

# Run view: step table and frozen graph

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Run view). Follow-up to BL-062 and BL-063. Judge and Approval details land with BL-079 and BL-080. Layer: web only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [ ] The task table becomes a step table: node name, kind icon, pass, attempt, status, duration.
- [ ] Failed or waiting steps are preselected, as BL-063 does for tasks.
- [ ] The graph tab uses the run's frozen layout with read-only node cards.
- [ ] Test: `apps/e2e/tests/node-run-view.spec.ts` opens a finished node run, sees the step rows and the failed step preselected. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
