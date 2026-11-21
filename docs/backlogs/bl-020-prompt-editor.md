---
id: BL-020
title: Prompt editor in the task drawer
type: backlog
status: todo
summary: Inspector shows a fixed prompt path, an Edit prompt button, and sends folder renames with the workflow save.
tags: [ui, web, editor, agents]
related: [DES-020, DES-018, DES-010]
updated: 2026-11-21
priority: P0
depends: [BL-019]
---

# Prompt editor in the task drawer

Design: [DES-020](../designs/des-020-fixed-prompt-files.md).
Depends on [BL-019](bl-019-fixed-prompt-paths.md) because the path
input goes away only after the schema drops `instructions`, and
because save must send `renames` to the updated PUT.

## Done when

- [ ] The Inspector path input is gone. The label is Prompt, the
      button is Edit prompt (always enabled), and muted text shows
      `tasks/<id>/prompt.md`, plus "Not created yet." when the file
      is missing.
- [ ] Edit prompt opens the existing textarea dialog and creates the
      file on first save. The dialog component is renamed to
      `PromptEditorDialog`.
- [ ] Saving a task rename sends `renames` with the workflow PUT so
      the server can move the folder in the same request.
- [ ] Playwright tests cover Edit prompt (create and save), the muted
      path text, and a rename that moves the folder, with video and
      screenshots.
