---
id: BL-097
title: Delete the task editor and task run view code
type: backlog
status: todo
summary: Remove the task Inspector and Sheet, task cards, PromoteButton and task-only run view parts now that nothing renders them.
tags: [web, cleanup]
related: [DES-037]
updated: 2026-11-22
priority: P1
depends: [BL-096]
---

# Delete the task editor and task run view code

Design: [DES-037](../designs/des-037-node-delivery.md) (Rollout). Layer: web only; deletion.

## Done when

- [ ] Task-only editor and run view components and their unit tests are deleted; the flag check in web is removed.
- [ ] No file imports a deleted module; `pnpm typecheck` passes.
- [ ] Test: `pnpm test` and `pnpm test:e2e` pass; `rg PromoteButton apps` finds nothing.
