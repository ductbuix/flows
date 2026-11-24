---
id: BL-200
title: "Run on a card"
type: backlog
status: done
summary: A card has a run bar, a run dialog and a list of its runs, as in the mock.
tags: [web, runs, docket]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-198, BL-197]
---

# Run on a card

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Rebuild `RunWorkflowDialog` and `CardRunsSection` on `run/start` and `run/list` filtered by card. Reuse `RunSheet` for the detail. (Canvas `RunBar` is BL-203.)

## Done when

- [x] Pick a workflow and inputs, start a run from a card.
- [x] The card lists its runs and opens one in a sheet.
- [x] e2e covers start, cancel and rerun from a card.
