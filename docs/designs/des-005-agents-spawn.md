---
id: DES-005
title: Agents and runtime spawn
type: design
status: active
summary: How agent CLI tasks run stateless with memories, and how they add tasks to a running graph.
tags: [agents, spawn, memory, cli]
related: [DES-002, DES-003, DES-006]
updated: 2026-11-20
---

# Agents and runtime spawn

- Headless agent CLI (Claude Code or Cursor CLI), cwd in its attempt dir,
  stateless: knows only its input dir, memories, upstream paths.
- `memory/*.md` listed on the task are copied into `input/memory/` before
  launch.
- Spawn: agent writes specs to `out/spawn/*.yaml` or calls
  `flow add-task`. Engine validates schema, unique id, existing needs, no
  cycles, `maxTasks`, `maxSpawnDepth`. Rejections are fed back in the
  agent's next input.
- Spawned tasks live only in the run's `graph.json`; a UI action can
  promote them into `workflow.yaml`.
