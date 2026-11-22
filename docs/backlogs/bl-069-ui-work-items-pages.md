---
id: BL-069
title: "Work items list and work item page"
type: backlog
status: todo
summary: New work item in the header, search and 37px Table; work item page in a 3-column grid with Start run in the header.
tags: [ui, web, work-items]
related: [DES-028]
updated: 2026-11-22
priority: P2
depends: [BL-064]
---

# Work items list and work item page

Design: [DES-028](../designs/des-028-ui-renovation-screens.md) (Work
items, Work item page). Fixes S5, #03, #05.

## Done when

- [ ] Work items: New work item in the header; search `InputGroup` in a
      `max-w-sm` toolbar; Table with Source Badge and Last run.
- [ ] Work item page: `grid grid-cols-1 gap-6 @5xl/main:grid-cols-3`,
      left column `@5xl/main:col-span-2` (749px) with Runs and Context,
      right (363px) with Notes and Attachments Cards.
- [ ] Context adds entities with one `Combobox` in the section toolbar.
- [ ] Notes Save is a default button at the right of the `CardFooter`.
- [ ] Header has Start run (primary) and a More menu.
