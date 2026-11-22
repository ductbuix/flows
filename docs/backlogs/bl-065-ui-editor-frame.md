---
id: BL-065
title: "Editor: full-bleed canvas, toolbar, Save ⌘S"
type: backlog
status: todo
summary: Graph and YAML full bleed, one 32px toolbar, fitView maxZoom 1, ⌘S. Add node moved to BL-077 (DES-036).
tags: [ui, web, editor]
related: [DES-028, DES-010, DES-036]
updated: 2026-11-22
priority: P1
depends: [BL-057, BL-058]
---

# Editor: full-bleed canvas, toolbar, Save ⌘S

Design: [DES-028](../designs/des-028-ui-renovation-screens.md) (Editor).
Fixes S12, S13, #11, #21.

Changed by [DES-036](../designs/des-036-canvas-editor-run-view.md)
(2026-11-22): the "Add task by kind" menu and the publish task flow
moved to BL-077 (Add node), and node cards are sized by DES-036. This
backlog keeps only the frame, so it can land before the node model.

## Done when

- [ ] The Inspector panel is removed; canvas and YAML pane are both full
      bleed below a `border-t` and fill the height.
- [ ] Toolbar (`PageToolbar`, 32px controls): Graph/YAML `Tabs`, Undo,
      Redo (`ghost` `icon` with Kbd Tooltips), Workflow settings
      (`outline`), Save (default, disabled when clean, Tooltip "Save
      ⌘S"). BL-077 adds Add node and BL-086 adds Run.
- [ ] ⌘S saves from the canvas, the Sheet and CodeMirror, and prevents
      the browser save dialog.
- [ ] `fitView` uses `maxZoom: 1` and `padding: 0.2`, so a one-node
      graph renders at 100%.
- [ ] YAML errors show as one destructive `Alert` above the canvas.
