---
id: BL-086
title: "Run on the canvas: Run, live status and Retry"
type: backlog
status: done
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

- [x] Toolbar "Run" starts a run from the first Trigger; with no Trigger it is disabled with "Add a trigger to run".
- [x] While a run is live, nodes show status Badge, timer and result over the websocket.
- [x] A failed node shows Retry, which sends `step_retry_requested`.
- [x] Test: `apps/e2e/tests/node-run.spec.ts` runs Trigger, Command, Output and sees each node done; a failing Command shows Retry. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.

## Notes

- Run uses the one Start run dialog (inputs, preflight, trust) and then follows the new run: `useNodeRun` fetches the run detail and subscribes over the websocket; snapshots map to cards through `NodeRunContext`. The button is disabled with "Add a trigger to run", or "Save to run" while the draft is unsaved, and shows a spinner while the run is live.
- Timer is measured in the browser from the snapshot that shows a step running to the one that shows it ended (the fold has no step times); result is the last attempt's stdout, or stderr for a failed step, cut at 600 characters.
- Retry calls the existing `POST /runs/:id/tasks/:task/retry`; no engine change was needed. Engine rerun and approve/reject for node runs stay open for BL-102 and BL-103.
- Layout baselines (BL-061) cover no node editor screen, so none needed a refresh.
