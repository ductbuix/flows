---
id: BL-077
title: "Canvas editor: drag, saved positions, Add node, empty state"
type: backlog
status: todo
summary: Free canvas with saved positions, Add node menu grouped Inputs, Steps, Flow with search, drag from a port to add, teaching empty state.
tags: [ui, web, editor, canvas]
related: [DES-036, DES-035, DES-027]
updated: 2026-11-22
priority: P0
depends: [BL-065, BL-076]
---

# Canvas editor: drag, saved positions, Add node, empty state

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md)
(Empty state, Add node menu, Nodes). Replaces the "Add task by kind"
and publish parts of BL-065.

## Done when

- [ ] Nodes drag freely; positions save on drag end through the layout
      endpoint without marking the editor dirty; reload keeps them.
- [ ] Nodes with no saved position are placed by dagre next to their
      inputs.
- [ ] "Add node" (`outline`, 32px) opens a `Popover` with a `Command`
      list (add shadcn `command`): search, then Inputs, Steps, Flow,
      from the web registry.
- [ ] Dropping a wire on empty canvas opens "Add a connected node",
      filtered by port, and wires the new node.
- [ ] Bad wires are refused with a toast naming the reason.
- [ ] An empty workflow shows the teaching `Empty` with the static
      diagram, three lines of our own copy, "Add a trigger" and "Start
      from a sample".
- [ ] Loop edges draw curved with a loop Badge; Judge edges show Yes
      or No.
- [ ] Playwright video, light and dark screenshots, and refreshed
      BL-061 layout baselines.
