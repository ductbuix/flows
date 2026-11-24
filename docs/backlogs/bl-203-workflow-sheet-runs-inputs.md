---
id: BL-203
title: "Workflow sheet: runs, inputs, rename and run"
type: backlog
status: todo
summary: The workflow sheet shows inputs, rename, cards that point to it and its runs; the canvas has a Run button.
tags: [web, workflows, runs]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-201, BL-197]
---

# Workflow sheet: runs, inputs, rename and run

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Use `workflow/rename`, `workflow/update` and `run/list`. Add run history on the canvas and past-run view with `run/get`, `run/get_log` and `run/retry_step`.

## Done when

- [ ] Rename and edit inputs from the sheet.
- [ ] Run from the canvas and watch node status live.
- [ ] A failed node offers Retry.
