---
id: BL-094
title: "Canvas: Add node menu, wiring and the teaching empty state"
type: backlog
status: todo
summary: Add node Popover with a searchable Command list, drag a wire to add a connected node, refuse bad wires, and the empty state.
tags: [web, editor, canvas]
related: [DES-036, DES-035]
updated: 2026-11-22
priority: P0
depends: [BL-077]
---

# Canvas: Add node menu, wiring and the teaching empty state

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Empty state, Add node menu). Layer: web only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [ ] Add shadcn `command` to `packages/ui`.
- [ ] "Add node" (`outline`, 32px) opens a `Popover` with a `Command` list: search, then Inputs, Steps, Flow, from the registry.
- [ ] Dropping a wire on empty canvas opens "Add a connected node", filtered by port, and wires the new node; a bad wire is refused with a toast that names the reason.
- [ ] An empty workflow shows the teaching `Empty` with "Add a trigger" and "Start from a sample".
- [ ] Test: `apps/e2e/tests/node-add.spec.ts` builds Trigger, Command, Output from empty and saves; YAML shows three nodes and two edges. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
