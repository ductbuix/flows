---
id: BL-070
title: "Workflows, workflow Overview and runs lists"
type: backlog
status: blocked
summary: Create on the Workflows page, Overview without a Start card, Runs and workflow Runs tables at 37px with readable labels.
tags: [ui, web, runs]
related: [DES-028, DES-029]
updated: 2026-11-22
priority: P2
depends: [BL-058, BL-059]
---

# Workflows, workflow Overview and runs lists

Retired on 2026-11-22 before the node workflow build. The status is `blocked` because the docs schema has no retired status; this file stays as history.

Design: [DES-028](../designs/des-028-ui-renovation-screens.md)
(Workflows, Workflow page),
[DES-029](../designs/des-029-ui-renovation-run-screens.md) (Workflow
Runs tab and Runs page). Fixes S7, S14, #06, #07, #22, #25.

## Done when

- [ ] Workflows page has Create workflow in the header and a search
      toolbar; names are labels with the id in a `HoverCard`.
- [ ] Overview sections are Tasks, Connections and impact, Inputs; empty
      ones use a section `Empty`; no Start card.
- [ ] Runs filters are two `Select`s at `w-48` (192px).
- [ ] Runs group rows and run rows are 37px; the workflow Runs tab rows
      are 37px (was 45px).
- [ ] The Run column shows the readable run label with `IdText`.
