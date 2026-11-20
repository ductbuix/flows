---
id: BL-009
title: Graph editor with YAML sync
type: backlog
status: todo
summary: React Flow editor for workflows that reads and writes workflow.yaml, kept in sync both ways.
tags: [ui, web, editor, yaml]
related: [DES-002, DES-008]
updated: 2026-11-20
priority: P2
depends: [BL-008]
---

# Graph editor with YAML sync

`workflow.yaml` is the source of truth ([DES-002](../designs/des-002-workflow-files.md)).
Write a UI design doc for the editor first.

## Done when

- [ ] Editing the graph updates `workflow.yaml`, and editing the file
      updates the graph.
- [ ] Spawned tasks from a run can be promoted into `workflow.yaml`.
- [ ] Playwright test with video and screenshots.
