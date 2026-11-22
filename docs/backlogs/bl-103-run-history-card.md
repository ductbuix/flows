---
id: BL-103
title: Run history on the canvas
type: backlog
status: done
summary: A run history Card in the canvas corner; picking a run shows the frozen graph and layout with results, read-only.
tags: [web, editor, runs]
related: [DES-036]
updated: 2026-11-22
priority: P1
depends: [BL-096]
---

# Run history on the canvas

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Run on the canvas). Layer: web only.

## Done when

- [x] A `Card` (bottom right, `w-72`) lists recent runs as `Item size="xs"` rows.
- [x] Picking one shows that run's frozen graph and layout with results, read-only, with "Back to editing".
- [x] Test: `apps/e2e/tests/node-run-history.spec.ts` opens a past run after editing the workflow and sees the old graph. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
