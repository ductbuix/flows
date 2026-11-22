---
id: BL-066
title: "Editor: task settings in a right Sheet"
type: backlog
status: todo
summary: Task Sheet (384px) with Name, Kind, CLI, inline Prompt Input with Model Selector, memory Combobox, connections and behavior.
tags: [ui, web, editor, ai-elements]
related: [DES-028, DES-010, DES-023]
updated: 2026-11-22
priority: P1
depends: [BL-065, BL-060]
---

# Editor: task settings in a right Sheet

Design: [DES-028](../designs/des-028-ui-renovation-screens.md) (Task
Sheet). Fixes #12, #13, S5, S15 and the memory gap in J-b.

## Done when

- [ ] Clicking a node or creating a task opens
      `SheetContent side="right"` with no width class (384px); header
      shows the task name, "Agent task · Cursor" and `IdText`.
- [ ] Body is a `FieldGroup` with `flex-1 overflow-y-auto px-4`; Kind
      and CLI are two-up (168px each); all controls are 32px.
- [ ] Prompt is the Prompt Input with Model Selector in its block-end
      addon and an "Open" button to the 576px prompt dialog.
- [ ] Memory files is a multiple `Combobox` with chips; picking writes
      the task `memory:` list.
- [ ] Behavior uses `Field orientation="horizontal"` with `Switch` on
      the right.
- [ ] Footer has Done and Delete task (`destructive`); Esc and overlay
      click close and return focus to the node.
- [ ] Evidence: light and dark screenshots at
      1440x900 of adding an agent task end to end (journey R2 in
      DES-030), attached to the PR.
