---
id: BL-067
title: "Editor: workflow settings Sheet and editor dialogs"
type: backlog
status: todo
summary: Workflow settings in a Sheet with Accordion sections; input rows open a form dialog; memory and prompt dialogs at 576px.
tags: [ui, web, editor]
related: [DES-028, DES-013, DES-021, BL-073]
updated: 2026-11-22
priority: P1
depends: [BL-065, BL-060, BL-073]
---

# Editor: workflow settings Sheet and editor dialogs

Design: [DES-028](../designs/des-028-ui-renovation-screens.md) (Workflow
settings Sheet),
[DES-029](../designs/des-029-ui-renovation-run-screens.md) (Dialogs).

## Done when

- [ ] "Workflow settings" opens a 384px right Sheet with an `Accordion`
      (`multiple`, first open): Name, goal and limits (the Name field from
      BL-073 moves here), Inputs, Agent defaults, Memory files.
- [ ] Inputs are `Item size="xs"` rows (mono name, type Badge, Required
      `Checkbox`); a row opens the 448px Edit input dialog.
- [ ] Memory files are `Item size="xs"` rows with a row menu, an
      `InputGroup` with an Add button, and Import .md (`outline`).
- [ ] Edit memory file and Edit prompt are 576px, with plain titles, the
      path in mono in the description, and Save in the footer.
