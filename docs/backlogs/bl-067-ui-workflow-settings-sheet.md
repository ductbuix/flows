---
id: BL-067
title: "Editor: workflow settings Sheet and editor dialogs"
type: backlog
status: todo
summary: Workflow settings in a Sheet with Accordion sections; memory and prompt dialogs at 576px. Inputs move to the Trigger node.
tags: [ui, web, editor]
related: [DES-028, DES-013, DES-021, BL-073, DES-036]
updated: 2026-11-22
priority: P1
depends: [BL-065, BL-060, BL-073]
---

# Editor: workflow settings Sheet and editor dialogs

Design: [DES-028](../designs/des-028-ui-renovation-screens.md) (Workflow
settings Sheet),
[DES-029](../designs/des-029-ui-renovation-run-screens.md) (Dialogs).

Changed by [DES-036](../designs/des-036-canvas-editor-run-view.md)
(2026-11-22): run inputs move to the Trigger node's Sheet (BL-095), and
limits gain the loop limit (`loopPasses`, DES-033).

## Done when

- [ ] "Workflow settings" opens a 384px right Sheet with an `Accordion`
      (`multiple`, first open): Name, goal and limits (the Name field from
      BL-073 moves here; the loop limit joins once BL-081 lands), Agent defaults,
      Memory files.
- [ ] Memory files are `Item size="xs"` rows with a row menu, an
      `InputGroup` with an Add button, and Import .md (`outline`).
- [ ] Edit memory file and Edit prompt are 576px, with plain titles, the
      path in mono in the description, and Save in the footer.
- [ ] The input rows and the 448px Edit input dialog are built in the
      Trigger node's Sheet by BL-095, not here.
