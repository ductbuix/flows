---
id: DES-005
title: Agents and runtime spawn
type: design
status: active
summary: How agent CLI tasks run stateless with memories, and how they grow a run's graph, including fan-out.
tags: [agents, spawn, memory, cli, fan-out, dynamic]
related: [DES-002, DES-003, DES-006]
updated: 2026-11-21
---

# Agents and runtime spawn

- Headless agent CLI (Claude Code or Cursor CLI), cwd in its attempt dir,
  stateless: knows only its instructions file (DES-002), input dir,
  memories and upstream paths. No agent limits are defined yet.
- `memory/*.md` listed on the task are copied into `input/memory/` before
  launch.
- Spawn: agent writes specs to `out/spawn/*.yaml` or calls
  `flow add-task`. Engine validates schema, unique id, existing needs, no
  cycles, `maxTasks`, `maxSpawnDepth`. Rejections are fed back in the
  agent's next input.
- Spawned tasks live only in the run's `graph.json`; a UI action can
  promote them into `workflow.yaml`.

## Fan-out through spawn

There is no `matrix` key; fan-out is an agent's job. Example: `plan`
reads `input/topic.md`, decides on three sources, and writes one spec per
source plus a task that joins them.

```yaml
# out/spawn/fetch-web.yaml (fetch-papers.yaml and fetch-news.yaml alike)
id: fetch-web
kind: command
run: node scripts/fetch.js web
needs: [plan]
```

```yaml
# out/spawn/merge.yaml
id: merge
kind: command
run: node scripts/merge.js
needs: [fetch-web, fetch-papers, fetch-news]
```

The engine validates the four specs, adds them to this run's
`graph.json`, and schedules the three fetches in parallel under the
workflow's limits. The next run may spawn a different set. Ledger entry
in [DES-007](des-007-tradeoffs.md).
