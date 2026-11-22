---
id: BL-104
title: Start dialog and Overview read nodes
type: backlog
status: done
summary: Behind the flag, the Start run dialog takes inputs from the Trigger and the workflow Overview lists nodes instead of tasks.
tags: [web, start, overview, nodes]
related: [DES-036, DES-021, DES-029]
updated: 2026-11-22
priority: P0
depends: [BL-093, BL-095]
---

# Start dialog and Overview read nodes

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md), [DES-037](../designs/des-037-node-delivery.md) (Rollout). Layer: web only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [x] The Start run dialog (BL-064) reads inputs from the Trigger it starts from and lists the CLIs of every CLI node for the trust preflight.
- [x] Overview's Tasks and Inputs sections (`OverviewTasksSection.tsx`, `OverviewInputsSection.tsx`) show nodes and Trigger inputs.
- [x] Test: `apps/e2e/tests/node-start.spec.ts` starts a run with a required input from the dialog and sees it in `RUN_INPUT`. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
