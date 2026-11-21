---
id: BL-020
title: Prompt editor and generated ids in the drawer
type: backlog
status: todo
summary: Inspector shows a read-only task id, an editable name, a fixed prompt path, and an Edit prompt button.
tags: [ui, web, editor, agents]
related: [DES-020, DES-018, DES-010]
updated: 2026-11-21
priority: P0
depends: [BL-019]
---

# Prompt editor and generated ids in the drawer

Design: [DES-020](../designs/des-020-fixed-prompt-files.md).
Depends on [BL-019](bl-019-fixed-prompt-paths.md) because the path
and id inputs go away only after the schema drops `instructions`
and the editor can call `newTaskId()`.

## Done when

- [ ] Adding a task in the editor uses `newTaskId()`. The Inspector
      id input is gone; the id is read-only muted text. A Name field
      is editable. Graph nodes and the run view show `name`, and
      fall back to `id`.
- [ ] The prompt path input is gone. The label is Prompt, the
      button is Edit prompt (always enabled), and muted text shows
      `tasks/<id>/prompt.md`, plus "Not created yet." when the file
      is missing.
- [ ] Edit prompt opens the existing textarea dialog and creates the
      file on first save. The dialog component is renamed to
      `PromptEditorDialog`.
- [ ] Playwright tests cover adding a task (generated id), editing
      the name, Edit prompt (create and save), and the muted path
      text, with video and screenshots.
