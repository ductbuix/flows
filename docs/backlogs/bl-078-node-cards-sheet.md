---
id: BL-078
title: "Node cards with settings on the node, and the node Sheet"
type: backlog
status: todo
summary: Shared NodeFrame, per-kind Body on the card (task, pills, target), node Sheet for the rest; replaces BL-066.
tags: [ui, web, editor, canvas, ai-elements]
related: [DES-036, DES-035, DES-027, DES-023]
updated: 2026-11-22
priority: P1
depends: [BL-077, BL-060]
---

# Node cards with settings on the node, and the node Sheet

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md)
(Nodes). Supersedes BL-066.

## Done when

- [ ] `apps/web/src/nodes/` has `defineNodeView` files for the kinds of
      BL-074; a shared `NodeFrame` renders header, ports, status slot,
      timer slot, result slot, Run step and Retry.
- [ ] Cards use `Card size="sm"`, `w-72` for steps and `w-60` for inputs
      and flow; dense controls inside are `sm`.
- [ ] Agent shows CLI and model pills (Model Selector) and the task
      Textarea; Prompt shows its text; Output shows its target Select.
- [ ] Edits write YAML through the shared helpers and node files
      through the PUT; undo and redo cover them.
- [ ] Clicking a node's settings button opens the 384px node Sheet:
      name, timeout, retry, memory Combobox, Delete node; Esc returns
      focus to the node.
- [ ] Trigger's Sheet holds the run inputs that BL-067 used to hold.
- [ ] Playwright video, light and dark screenshots, refreshed
      baselines.
