---
id: BL-081
title: Loops with back edges and a loop limit
type: backlog
status: todo
summary: Loop edges found as in OpenBot with ties by YAML order; each round is a new pass; loopPasses stops runaway loops.
tags: [engine, web, loops]
related: [DES-034]
updated: 2026-11-22
priority: P1
depends: [BL-079]
---

# Loops with back edges and a loop limit

Design: [DES-034](../designs/des-034-node-engine.md) (Loops).

## Done when

- [ ] Loop edges: self edges, and edges into each cycle's entry node, ties broken by node order in `workflow.yaml`; the BL-075 cycle error is removed.
- [ ] A newer active result on a loop edge starts the next pass of its target and what follows.
- [ ] Pass `loopPasses + 1` fails the node with reason `loop_limit`; validation warns on a cycle with no Judge.
- [ ] Loop edges draw curved with a loop Badge; nodes show a pass count.
- [ ] Test: `packages/engine/src/nodes/walk-loops.test.ts` (Judge loop ending on Yes, loop hitting the limit, nested loops, self loop). Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
