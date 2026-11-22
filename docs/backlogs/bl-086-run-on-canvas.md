---
id: BL-086
title: "Run on the canvas: Run step, live status, run history"
type: backlog
status: todo
summary: Per-node Run step, live status, timer and result on nodes, Run from here, and a run history panel on the canvas.
tags: [ui, web, editor, canvas, runs, engine]
related: [DES-036, DES-034]
updated: 2026-11-22
priority: P1
depends: [BL-078]
---

# Run on the canvas: Run step, live status, run history

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Run
on the canvas), [DES-034](../designs/des-034-node-engine.md) (Partial
runs).

## Done when

- [ ] Run step on a node starts a run with `only: [nodeId]` and the
      latest upstream results.
- [ ] Run from here starts a run with `from: nodeId`, reusing unchanged
      earlier steps.
- [ ] While a run is live, nodes show status Badge, timer and result
      over the websocket; failed nodes show Retry.
- [ ] The run history Card lists recent runs; picking one shows the
      frozen graph and layout with results, read-only, with "Back to
      editing".
- [ ] Engine tests for partial runs; Playwright video and light and
      dark screenshots.
