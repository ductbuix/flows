---
id: BL-102
title: Run step and Run from here
type: backlog
status: done
summary: "Partial runs: only one node with the latest upstream results, or from a node reusing unchanged earlier steps."
tags: [engine, web, runs]
related: [DES-034, DES-036]
updated: 2026-11-22
priority: P1
depends: [BL-096]
---

# Run step and Run from here

Design: [DES-034](../designs/des-034-node-engine.md) (Partial runs), [DES-036](../designs/des-036-canvas-editor-run-view.md) (Run on the canvas).

## Done when

- [x] `run_started` takes `only` and `from`; the walk and scope follow DES-034, inputs come from the latest done steps.
- [x] Run step on a node and "Run from selected node" in the Run menu start them.
- [x] Test: `packages/engine/src/nodes/partial-runs.test.ts` (only, from, reuse when unchanged, rerun when changed) and `apps/e2e/tests/node-run-step.spec.ts`. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
