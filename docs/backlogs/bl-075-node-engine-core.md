---
id: BL-075
title: "Node walk: nextActions for forward graphs"
type: backlog
status: todo
summary: "Pure nextActions over a node graph: forward order, due rules, joins, skip on no active input, branch-aware edges; not wired."
tags: [engine, walk, nodes]
related: [DES-034]
updated: 2026-11-22
priority: P0
depends: [BL-089]
---

# Node walk: nextActions for forward graphs

Design: [DES-034](../designs/des-034-node-engine.md) (The walk). Layer: engine only; a pure function with no I/O.

## Done when

- [ ] `packages/engine/src/nodes/walk.ts` exports `nextActions(graph, scope, steps)` returning run and skip actions.
- [ ] Rules: the start trigger is due at run start; forward order; join waits for all forward inputs; an edge is active when its source is done and, with a branch, the branch matches; no active input means skip, and skips flow on.
- [ ] Loop edges are out of scope here (BL-081); a cycle returns a clear error for now.
- [ ] Test: `packages/engine/src/nodes/walk.test.ts` table cases: chain, fan-out, join, skip chain, branch taken and missed (with a fake branch step), several triggers.
