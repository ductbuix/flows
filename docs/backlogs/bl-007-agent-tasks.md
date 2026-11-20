---
id: BL-007
title: Agent tasks and spawn
type: backlog
status: todo
summary: kind agent tasks via Claude Code and Cursor CLI adapters, memories, and runtime spawn of new tasks.
tags: [agents, spawn, cli]
related: [DES-005]
updated: 2026-11-20
priority: P1
depends: [BL-006]
---

# Agent tasks and spawn

Spec: [DES-005](../designs/des-005-agents-spawn.md).

## Done when

- [ ] Claude Code and Cursor CLI adapters run headless in the attempt dir.
- [ ] Listed `memory/*.md` files are copied to `input/memory/` before
      launch.
- [ ] Specs in `out/spawn/*.yaml` are validated (schema, unique id, needs,
      no cycles, `maxTasks`, `maxSpawnDepth`) and added to `graph.json`;
      rejections reach the agent's next input.
- [ ] `agents` limits apply at each level.
