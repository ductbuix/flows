---
id: BL-089
title: Step events and the step fold
type: backlog
status: todo
summary: Add step_* events next to today's task events and a pure fold of steps per node and pass; nothing emits them yet.
tags: [engine, shared, events, fold]
related: [DES-034, DES-003]
updated: 2026-11-22
priority: P0
depends: [BL-074]
---

# Step events and the step fold

Design: [DES-034](../designs/des-034-node-engine.md) (Steps, Event types). Layer: shared events plus one new engine module.

## Done when

- [ ] `packages/shared/src/events.ts` gains `step_started`, `step_done`, `step_failed`, `step_skipped`, `step_approved`, `step_rejected`, `step_retry_requested`, `step_cancelled`; `attempt_*` gain optional `nodeId` and `pass`. Task events stay until BL-098.
- [ ] `packages/engine/src/nodes/fold-steps.ts` folds a node run's events into steps per node and pass with the DES-034 states.
- [ ] Today's fold and every task test are unchanged.
- [ ] Test: `packages/engine/src/nodes/fold-steps.test.ts` covers each event, passes, retries and a run that ends.
