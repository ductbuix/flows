---
id: BL-202
title: "Canvas: Add node, node settings, undo and redo"
type: backlog
status: done
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

- [x] Every node kind in the registry can be added and configured.
- [x] Undo and redo cover add, move, edit and delete.
- [x] An invalid workflow shows validation errors before save.
