---
id: BL-068
title: "Home: work item first"
type: backlog
status: todo
summary: First launch starts from a work item; Home in two columns of 66px Items with readable labels and relative times.
tags: [ui, web, ux, work-items]
related: [DES-028, DES-025]
updated: 2026-11-22
priority: P2
depends: [BL-059, BL-064]
---

# Home: work item first

Design: [DES-028](../designs/des-028-ui-renovation-screens.md) (Home).
Fixes #01, #02.

## Done when

- [ ] Empty Home shows a page `Empty` "Start with a work item" with New
      work item (default) and Create a workflow (`outline`).
- [ ] New work item has a Workflow `Combobox` whose last option "Create
      workflow" swaps in the create form and returns with it picked.
- [ ] Populated Home is `grid grid-cols-1 gap-6 @5xl/main:grid-cols-2`
      (556px columns): Needs you and Running left, Work items and Recent
      runs right, five rows each, "All" as a `ghost` button.
- [ ] Rows are `Item variant="outline" size="sm"`, 66px, with one-line
      readable title and description; Running rows show "2 of 5 tasks".
- [ ] Journey R1 in DES-030 takes 7 clicks from first launch to a
      started run.
