---
id: BL-015
title: Fix agent task kind in the editor
type: backlog
status: todo
summary: Switching a task to agent must write a valid task shape and show field errors on save.
tags: [ui, web, editor, agent]
related: [DES-018, DES-005]
updated: 2026-11-21
priority: P0
depends: []
---

# Fix agent task kind in the editor

Design: [DES-018](../designs/des-018-agent-kind-and-file-editing.md).
Agent task shape: [DES-005](../designs/des-005-agents-spawn.md).

## Done when

- [ ] Switching kind in the Inspector replaces the task with a valid
      shape for the new kind, using the defaults in DES-018, and drops
      fields the new kind does not use.
- [ ] Shared fields (`id`, `needs`, `approval`, `when`, `retry`,
      `repeat`, `continueOnError`) are kept.
- [ ] Validation errors show next to the Inspector field they belong
      to. Save is not a silent no-op.
- [ ] Unit tests cover the kind-switch YAML edit, including comments
      and key order of other tasks.
- [ ] Playwright tests from DES-018 for the kind switch, with video
      and screenshots.
