---
id: BL-087
title: Run view for node steps
type: backlog
status: todo
summary: Follow-up to BL-062 and BL-063, the step table with passes, Judge and Approval details, graph tab with the frozen layout.
tags: [ui, web, runs, nodes]
related: [DES-036, DES-029]
updated: 2026-11-22
priority: P1
depends: [BL-075, BL-079, BL-080]
---

# Run view for node steps

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Run
view). Follow-up to BL-062 and BL-063.

## Done when

- [ ] The task table becomes a step table: node name, kind icon, pass,
      attempt, status, duration; one row per pass.
- [ ] Failed or waiting steps are preselected, as BL-063 does for tasks.
- [ ] A Judge step shows its verdict and rule; an Approval step shows
      the decision and time.
- [ ] The graph tab uses the run's frozen layout with read-only node
      cards.
- [ ] Playwright video, light and dark screenshots, refreshed
      baselines.
