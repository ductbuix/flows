---
id: BL-009
title: Graph editor with YAML sync
type: backlog
status: todo
summary: React Flow editor for workflows that reads and writes workflow.yaml, kept in sync both ways.
tags: [ui, web, editor, yaml]
related: [DES-002, DES-008, DES-010]
updated: 2026-11-20
priority: P2
depends: [BL-008]
---

# Graph editor with YAML sync

`workflow.yaml` is the source of truth ([DES-002](../designs/des-002-workflow-files.md)).
Screen design: [DES-010](../designs/des-010-graph-editor.md) (draft).

## Done when

- [ ] DES-010 open questions answered and its status set to `active`.
- [ ] Editing the graph updates `workflow.yaml`, and editing the file
      updates the graph.
- [ ] Spawned tasks from a run can be promoted into `workflow.yaml`.
- [ ] Playwright test with video and screenshots.
