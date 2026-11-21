---
id: BL-024
title: Delete a task in the editor with confirm and undo
type: backlog
status: todo
summary: Drawer and canvas delete one task, confirm with dependents and mention warnings, and undo the pending edit before save.
tags: [ui, web, editor]
related: [DES-022, DES-010, DES-013]
updated: 2026-11-21
priority: P0
depends: [BL-023]
---

# Delete a task in the editor with confirm and undo

Design: [DES-022](../designs/des-022-remove-task.md).
Depends on [BL-023](bl-023-remove-task-trash.md) so Save moves the
folder and can return 409 when a live or queued run still needs
the task.

## Done when

- [ ] The drawer has a danger-style Delete task button. Delete
      and Backspace on a selected canvas node open the same
      confirm, except while typing in an input, textarea,
      contenteditable, or CodeMirror. React Flow's default
      delete key and multi-select are off. Only one task can be
      deleted at a time.
- [ ] The confirm lists dependents by name, falling back to id,
      and warns (never blocks) if another task's `run` or
      `prompt.md` mentions the removed id or its `UPSTREAM_*`
      env var. Confirming applies `removeTask` as a pending
      edit. The last task cannot be deleted.
- [ ] Cmd/Ctrl+Z undoes graph and inspector edits, including
      delete, from a bounded snapshot stack (50). Cmd/Shift+Z
      and Ctrl+Y redo. The stack clears on a successful save,
      a reload, and a conflict "use disk" choice. The YAML pane
      keeps CodeMirror undo.
- [ ] Save uses the existing PUT. A 409 `task_in_live_run`
      shows an error toast and keeps the pending edit. A
      leftover mention after a raw YAML save shows a warning
      toast and does not fail the save.
- [ ] Playwright covers the button, the key (and that it does
      not fire while typing), the confirm, undo, the last-task
      guard, and a successful save, with video and screenshots.
