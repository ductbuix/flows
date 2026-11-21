---
id: DES-005
title: Agents and runtime spawn
type: design
status: active
summary: How agent CLI tasks run stateless with memories, and how they grow a run's graph, including fan-out.
tags: [agents, spawn, memory, cli, fan-out, dynamic]
related: [DES-002, DES-003, DES-006, DES-019, DES-020]
updated: 2026-11-21
---

# Agents and runtime spawn


- Headless agent CLI (Claude Code or Cursor CLI), cwd in its attempt dir,
  stateless: knows only its prompt file (DES-002, DES-020), input dir,
  memories and upstream paths. Turn/token/cost agent limits are not
  defined yet (DES-007); the `agents` concurrency cap still applies
  (DES-003).
- Adapters: `claude --print --permission-mode dontAsk --add-dir <workflow>`
  and `agent -p --force --trust --workspace <attempt> --add-dir <workflow>`
  (DES-006). `TASK_INSTRUCTIONS` is the absolute path of the derived
  prompt (`tasks/<taskId>/prompt.md`, or a spawned task's stamped
  `promptDir`); the CLI prompt tells the agent to follow it.
- `memory/*.md` listed on the task are copied into the task's
  `input/memory/` before launch.
- Spawn: agent writes specs to `out/spawn/<stem>.yaml`, and for an
  agent (or a task with an agent judge) the prompt and judge files
  under `out/spawn/<stem>/` (DES-020). Specs have no `id`; the stem
  is the identity and `needs` may name sibling stems or existing
  task ids. The engine assigns a generated id, rewrites `needs` to
  real ids, and validates schema, unique ids, existing needs, no
  cycles, `maxTasks`, `maxSpawnDepth`, and that required prompt and
  judge files exist. Accepted specs emit `tasks_spawned` and update
  `graph.json`. Rejections are written to `input/spawn-rejections.md`
  for the next attempt (retry when `retry` is set).
- Spawned tasks are stamped with `spawnDepth`, `spawnedBy`, and
  `promptDir` (run-root relative, using the stem folder). They live
  only in the run's `graph.json`; a UI action can promote them into
  `workflow.yaml`, which copies the prompt folder into `tasks/<id>/`
  and keeps the generated id.

## Fan-out through spawn

There is no `matrix` key; fan-out is an agent's job. Example: a plan
task (`task-a1b2c3d4`) reads `input/topic.md`, decides on three
sources, and writes one spec per source plus a task that joins them.

```yaml
# out/spawn/fetch-web.yaml (fetch-papers.yaml and fetch-news.yaml alike)
kind: command
name: Fetch web
run: node scripts/fetch.js web
needs: [task-a1b2c3d4]
```

```yaml
# out/spawn/merge.yaml
kind: command
name: Merge
run: node scripts/merge.js
needs: [fetch-web, fetch-papers, fetch-news]
```

The engine assigns each spec a generated id, rewrites sibling stems
in `needs` to those ids, adds the four tasks to this run's
`graph.json`, and schedules the three fetches in parallel under the
workflow's limits. The next run may spawn a different set. Ledger entry
in [DES-007](des-007-tradeoffs.md).
