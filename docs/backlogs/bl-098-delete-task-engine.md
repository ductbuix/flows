---
id: BL-098
title: Delete the task engine path, spawn and old conditions
type: backlog
status: todo
summary: Remove spawn, old condition shapes, needs branches, repeat, task events and fold, the task schema and the flag.
tags: [engine, shared, server, cleanup]
related: [DES-034, DES-005, DES-004]
updated: 2026-11-22
priority: P1
depends: [BL-097]
---

# Delete the task engine path, spawn and old conditions

Design: [DES-034](../designs/des-034-node-engine.md) (Removed code), [DES-037](../designs/des-037-node-delivery.md) (Rollout). Deletion across shared, engine and server.

## Done when

- [ ] Spawn files, `conditions-expr.ts`, the old shapes in `conditions.ts`, `needs.ts` branch rules, `decideLoop` and `evalUntil`, task events, `fold.ts` and `fold-apply.ts`, the promote route and `FLOWS_NODES` are deleted with their tests; `retryMax` lives on the node path.
- [ ] `workflowSchema` is the node schema; `runner.ts` has no kind branch.
- [ ] Test: `pnpm test` and `pnpm test:e2e` pass; `rg "tasks_spawned|task_succeeded|FLOWS_NODES" packages apps` finds nothing.
