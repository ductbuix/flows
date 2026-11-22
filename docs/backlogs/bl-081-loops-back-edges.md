---
id: BL-081
title: Loops with back edges and a loop limit
type: backlog
status: todo
summary: Loop edges found as in DES-034, passes per node, limits.loopPasses with loop_limit failure, pass counts on the canvas.
tags: [engine, web, nodes, loops]
related: [DES-034, DES-036]
updated: 2026-11-22
priority: P1
depends: [BL-079]
---

# Loops with back edges and a loop limit

Design: [DES-034](../designs/des-034-node-engine.md) (Loops).

## Done when

- [ ] Loop edges: self edges, and edges into each cycle's entry node,
      with ties broken by node order in `workflow.yaml`.
- [ ] A newer active result on a loop edge starts the next pass of its
      target and of what follows it.
- [ ] Pass `loopPasses + 1` fails the node with reason `loop_limit`.
- [ ] Validation warns on a cycle with no Judge.
- [ ] Nodes show a pass count after a run; the run view lists one row
      per pass.
- [ ] Walk table tests: Judge loop ending on Yes, loop hitting the
      limit, nested loops, a self loop.
