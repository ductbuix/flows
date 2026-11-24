---
id: BL-202
title: "Canvas: Add node, node settings, undo and redo"
type: backlog
status: todo
summary: Add node menu with search, node settings, toolbar with undo, redo and fit view.
tags: [web, editor, canvas]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: [BL-201]
---

# Canvas: Add node, node settings, undo and redo

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Rebuild `AddNodeMenu`, `NodeSettings`, `ModelRow`, `MultiPick` and `FlowToolbar` on real node schemas. Validate with `workflow/validate`.

## Done when

- [ ] Every node kind in the registry can be added and configured.
- [ ] Undo and redo cover add, move, edit and delete.
- [ ] An invalid workflow shows validation errors before save.
