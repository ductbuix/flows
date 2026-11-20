---
id: BL-013
title: Workflow lifecycle and memory files
type: backlog
status: todo
summary: Create, rename and delete workflows and edit memory files, with consequence warnings and confirms.
tags: [ui, web, workflow, memory, files]
related: [DES-002, DES-005, DES-013]
updated: 2026-11-21
priority: P2
depends: [BL-009]
---

# Workflow lifecycle and memory files

Design: [DES-013](../designs/des-013-workflow-editing.md).

## Done when

- [ ] Create, rename and delete endpoints, blocked with `409` while a run
      of the workflow is live.
- [ ] Rename moves the dir, updates `id:` with the Document API, and the
      dialog lists the consequences from DES-013.
- [ ] Delete removes the workflow dir after the user types the id.
- [ ] Memory files can be listed, created, edited, renamed and deleted;
      rename and delete warn with the tasks that reference the file.
- [ ] Playwright tests from DES-013 with video and screenshots.
