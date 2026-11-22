---
id: BL-086
title: "Run on the canvas: Run, live status and Retry"
type: backlog
status: todo
summary: Behind the flag, Run starts from the first Trigger and nodes show live status, timer and result; failed nodes show Retry.
tags: [web, editor, runs]
related: [DES-036, DES-034]
updated: 2026-11-22
priority: P0
depends: [BL-093, BL-078]
---

# Run on the canvas: Run, live status and Retry

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Run on the canvas). Run step, Run from here and run history moved to BL-102 and BL-103. Layer: web only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [ ] Toolbar "Run" starts a run from the first Trigger; with no Trigger it is disabled with "Add a trigger to run".
- [ ] While a run is live, nodes show status Badge, timer and result over the websocket.
- [ ] A failed node shows Retry, which sends `step_retry_requested`.
- [ ] Test: `apps/e2e/tests/node-run.spec.ts` runs Trigger, Command, Output and sees each node done; a failing Command shows Retry. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
