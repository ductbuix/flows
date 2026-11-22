---
id: BL-075
title: Node engine core, events and walk
type: backlog
status: todo
summary: Steps and passes, new event types, the walk with joins and skips, executor registry; spawn and old conditions removed.
tags: [engine, events, nodes, registry]
related: [DES-034, DES-035, DES-003]
updated: 2026-11-22
priority: P0
depends: [BL-074]
---

# Node engine core, events and walk

Design: [DES-034](../designs/des-034-node-engine.md),
[DES-035](../designs/des-035-node-registry.md) (Engine).

## Done when

- [ ] Event schemas in `packages/shared/src/events.ts` match the DES-034
      table; removed types are gone.
- [ ] The fold tracks steps per node and pass; an old run fails
      validation with a clear error (DES-033 Old files).
- [ ] `nextActions` implements forward order, due rules, joins and
      skip on no active input, with table tests.
- [ ] `packages/engine/src/nodes/` has executors for trigger, prompt,
      agent, command and output (`folder`); `runner.ts` has no kind
      branches.
- [ ] Data passing: `input/text.md`, `input/files/<fromNodeId>/`,
      `UPSTREAM_*`, `NODE_IN`, `NODE_OUT` and the other env names of
      DES-034.
- [ ] Spawn code, the old condition shapes, `needs.ts` branch rules and
      the `repeat` logic are deleted with their tests.
- [ ] Append, then act holds for every kind; the resume harness covers
      a crash between `step_started` and the action for each kind.
- [ ] Limits: agent steps count against `agents`; no-process steps hold
      no slot.
