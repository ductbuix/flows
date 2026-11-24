---
id: BL-201
title: "Canvas editor: nodes, edges and layout"
type: backlog
status: todo
summary: The workflow editor shows the node canvas with node cards and saves layout and YAML.
tags: [web, editor, canvas]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: [BL-193]
---

# Canvas editor: nodes, edges and layout

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Replace the YAML textarea with the mock canvas (`FlowNodes`, `NodeShell`, `StepConnectors`, `TriggerInputs`). Use `workflow/get`, `workflow/save` and `workflow/save_layout`. Keep a YAML view as a tab.

## Done when

- [ ] A saved workflow opens on the canvas with its saved layout.
- [ ] Moving a node and saving updates the layout file.
- [ ] Edits keep YAML comments and key order.
