---
id: BL-065
title: "Editor: full-bleed canvas, toolbar, Add task by kind, Save ⌘S"
type: backlog
status: todo
summary: Graph and YAML full bleed, one 32px toolbar, Add task menu by kind, publish added via the Sheet, fitView maxZoom 1, ⌘S.
tags: [ui, web, editor]
related: [DES-028, DES-010]
updated: 2026-11-22
priority: P1
depends: [BL-057, BL-058]
---

# Editor: full-bleed canvas, toolbar, Add task by kind, Save ⌘S

Design: [DES-028](../designs/des-028-ui-renovation-screens.md) (Editor).
Fixes S12, S13, #11, #19, #21.

## Done when

- [ ] The Inspector panel is removed; canvas and YAML pane are both full
      bleed below a `border-t` and fill the height.
- [ ] Toolbar (`PageToolbar`, 32px controls): Graph/YAML `Tabs`, Undo,
      Redo (`ghost` `icon` with Kbd Tooltips), Workflow settings
      (`outline`), Add task (`outline` + menu: Agent task, Command task,
      Publish task), Save (default, disabled when clean, Tooltip "Save
      ⌘S").
- [ ] ⌘S saves from the canvas, the Sheet and CodeMirror, and prevents
      the browser save dialog.
- [ ] Publish task opens the task Sheet with the connection Select
      first; no node is added until a connection is picked.
- [ ] Nodes are `Card size="sm"` `w-56`; selected `ring-2 ring-ring`;
      `fitView` uses `maxZoom: 1` and `padding: 0.2`, so a one-task
      graph renders at 100%.
- [ ] YAML errors show as one destructive `Alert` above the canvas.
- [ ] Evidence: light and dark screenshots at
      1440x900 of the editor on a 1-task and a 5-task workflow, ⌘S, and
      Add publish, attached to the PR.
