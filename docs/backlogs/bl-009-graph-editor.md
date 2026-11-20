---
id: BL-009
title: Graph editor with YAML sync
type: backlog
status: done
summary: React Flow editor with dagre layout and a CodeMirror YAML pane, kept in sync with workflow.yaml both ways.
tags: [ui, web, editor, yaml]
related: [DES-002, DES-008, DES-010, DES-012, DES-013]
updated: 2026-11-21
priority: P2
depends: [BL-008]
---

# Graph editor with YAML sync

`workflow.yaml` is the source of truth ([DES-002](../designs/des-002-workflow-files.md)).
Screen design: [DES-010](../designs/des-010-graph-editor.md) (active).
Workflow create, rename, delete and memory editing are BL-013.

## Done when

- [x] DES-010 open questions answered and its status set to `active`.
- [x] Editing the graph updates `workflow.yaml`, and editing the file
      updates the graph.
- [x] YAML pane is CodeMirror 6 with diagnostics from `yaml` plus the zod
      schema, mapped to source ranges.
- [x] Layout is automatic with dagre; nothing is saved besides the YAML.
- [x] Graph writes keep comments and key order (DES-013 test plan passes).
- [x] Disk changes reload or open the conflict dialog (DES-013); saves
      with a stale hash get `409`.
- [x] Spawned tasks from a run can be promoted into `workflow.yaml`.
- [x] Playwright tests from DES-010 with video and screenshots.
