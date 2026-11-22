---
id: BL-077
title: "Canvas: show node workflows with saved positions and drag"
type: backlog
status: todo
summary: Behind the flag, the editor canvas renders nodes and edges, places new nodes with dagre, and saves positions on drag end.
tags: [web, editor, canvas, layout]
related: [DES-036, DES-033]
updated: 2026-11-22
priority: P0
depends: [BL-065, BL-092]
---

# Canvas: show node workflows with saved positions and drag

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Editor frame, Nodes). Layer: web only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [ ] With the flag on, the editor reads nodes and edges and draws them with a plain card per node (full cards come in BL-078).
- [ ] Nodes drag freely; positions save on drag end (debounced) through the layout endpoint without marking the editor dirty.
- [ ] Nodes with no saved position are placed by dagre next to their inputs.
- [ ] With the flag off, the task editor is unchanged and its e2e specs pass.
- [ ] Test: `apps/e2e/tests/node-canvas.spec.ts` drags a node, reloads, and sees it in place. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
