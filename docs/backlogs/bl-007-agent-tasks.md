---
id: BL-007
title: Agent tasks and spawn
type: backlog
status: done
summary: kind agent tasks via Claude Code and Cursor CLI adapters, memories, and runtime spawn of new tasks.
tags: [agents, spawn, cli]
related: [DES-005, DES-020]
updated: 2026-11-21
priority: P1
depends: [BL-006]
---

# Agent tasks and spawn

Spec: [DES-005](../designs/des-005-agents-spawn.md). The free
`instructions` path in the Done when list is superseded by
[DES-020](../designs/des-020-fixed-prompt-files.md). The env name
`TASK_INSTRUCTIONS` is unchanged.

## Done when

- [x] Claude Code and Cursor CLI adapters run headless in the attempt dir.
- [x] The task's `instructions` file is the agent's prompt and its path
      is in `TASK_INSTRUCTIONS`.
- [x] Listed `memory/*.md` files are copied to `input/memory/` before
      launch.
- [x] Specs in `out/spawn/*.yaml` are validated (schema, unique id, needs,
      no cycles, `maxTasks`, `maxSpawnDepth`) and added to `graph.json`;
      rejections reach the agent's next input.
- [x] `agents` limits apply at each level.
