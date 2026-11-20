# Flows: design v1

Local web app where a user builds workflows of tasks. Each task is an OS process (command, node, python, or an AI agent CLI). Runs on one machine, bound to 127.0.0.1.

## Stack

- `apps/web`: Vite, React, shadcn (preset `b1HvWXNDFK`), React Flow later.
- `apps/server`: Hono on `@hono/node-server`, websockets for live events, typed RPC client (`hc<AppType>`) shared with web.
- `packages/shared`: zod schemas and types.
- `packages/engine` (next): scheduler, event log, process runner.
- Storage: SQLite event log plus files on disk.

## Domain model

| Entity   | Holds                                                | Lives in                        |
| -------- | ---------------------------------------------------- | ------------------------------- |
| Workflow | goal, tasks, edges, limits                           | `workflow.yaml` in its dir      |
| Task     | kind, command, needs, condition, loop policy, limits | `workflow.yaml` or spawned spec |
| Run      | one execution, frozen graph                          | SQLite plus `runs/<runId>/`     |
| TaskRun  | state of one task in one run                         | derived from events             |
| Attempt  | one process launch: pid, exit code, timings          | events plus `attempt-<n>/`      |
| Event    | append-only fact                                     | SQLite `events` table           |

A first agent is a task with `kind: agent`. Many instances means several agent tasks or a `matrix`.

## Folder layout

```
~/.flowapp/
  app.db
  config.yaml                 # global limits
  workflows/<workflowId>/
    workflow.yaml             # source of truth; editor reads and writes it
    memory/*.md               # initial memories for agent tasks
    input/  output/  SUMMARY.md
    runs/<runId>/
      graph.json              # frozen graph plus spawned tasks
      tasks/<taskId>/
        input/
        attempt-<n>/out/  attempt-<n>/SUMMARY.md  stdout.log  stderr.log
        latest -> attempt-<n>
```

A dir is the compacted context of its object. Each task writes its own `SUMMARY.md`; the engine warns if it is missing.

## Workflow file

```yaml
id: research-report
goal: Produce a sourced report on input/topic.md
limits: { concurrency: 3, agents: 2, maxTasks: 50, maxSpawnDepth: 2 }
tasks:
  - id: plan
    kind: agent
    cli: claude # or cursor
    prompt: Read input/topic.md and plan the research.
    memory: [memory/style.md]
    spawn: true
    retry: { max: 2 }
  - id: fetch
    kind: command
    run: node scripts/fetch.js
    needs: [plan]
    matrix: { source: [web, papers, news] }
  - id: check
    kind: command
    run: python check.py
    needs: [fetch]
    repeat: { max: 5, until: { expr: "json('out/score.json').score >= 0.8" } }
  - id: publish
    kind: command
    run: cp -r $UPSTREAM_check/out/* $WF_OUTPUT/
    needs: [check]
    when: { exit: 0 }
```

Tasks read upstream outputs by path. Env: `UPSTREAM_<taskId>`, `TASK_IN`, `TASK_OUT`, `PREV_ATTEMPT`, `WF_DIR`, `WF_INPUT`, `WF_OUTPUT`, `RUN_ID`.

## Task lifecycle

`pending -> ready -> running -> (condition) -> succeeded | failed`, with `pending -> skipped` when `when` is false and `running -> running` for retry or repeat. Skips propagate unless a dependant allows `skipped`. A failure fails the run unless `continueOnError`.

## Engine

1. Append, then act: every change is an event written in a transaction before its side effect.
2. State is a fold over events; the scheduler keeps no state outside the log.
3. Each event triggers a tick: compute ready tasks, apply limits, spawn processes (detached, own process group), stream logs to files and the websocket.
4. Resume: replay the log; for started attempts with no exit, re-attach by pid if alive, else record `interrupted` and apply retry policy. Finished tasks never rerun.
5. Attempt ids are written before launch so a crash cannot start a duplicate.

## Conditions

| Kind  | Checks                                        | Cost  |
| ----- | --------------------------------------------- | ----- |
| exit  | exit code equals or is in a set               | free  |
| expr  | safe expression over output files             | cheap |
| agent | agent CLI judges output, returns pass or fail | slow  |

Combine with `all` / `any`; cheap kinds evaluate first. The same shape serves `when`, `until`, and branch edges.

## Loops

- `retry`: on non-zero exit or timeout. Default max 3, backoff 2s doubling.
- `repeat`: on success until `until` passes. Default max 5.
- Separate counters; every launch gets its own `attempt-<n>/`.

## Agents and runtime spawn

- Headless agent CLI, cwd in its attempt dir, stateless: knows only its input dir, memories, upstream paths.
- `memory/*.md` listed on the task are copied into `input/memory/` before launch.
- Spawn: agent writes specs to `out/spawn/*.yaml` or calls `flow add-task`. Engine validates schema, unique id, existing needs, no cycles, `maxTasks`, `maxSpawnDepth`. Rejections are fed back in the agent's next input.
- Spawned tasks live only in the run's `graph.json`; a UI action can promote them into `workflow.yaml`.

## Concurrency

Nested limits: global, workflow, run, task group. A task starts only when it fits under every level. Agent tasks also count against an `agents` limit at each level.

## Sandboxing

- Baseline everywhere: cwd in attempt dir, scrubbed env, own process group, timeout.
- File access: write only inside the workflow dir via `sandbox-exec` (macOS) or `bubblewrap` (Linux).
- Agent CLIs: use their own permission and allowed-dir flags.
- Fallback: run unrestricted with a warning badge.

## Trade-offs

| Decision                         | Risk                            | Revisit when                        |
| -------------------------------- | ------------------------------- | ----------------------------------- |
| Tasks read upstream dirs by path | can read beyond declared needs  | runs must move to another machine   |
| SQLite log, no queue             | single-process engine           | a second machine runs tasks         |
| Sandbox best effort              | unsandboxed on unsupported OSes | first Windows user                  |
| Agent judge conditions           | slow, not deterministic         | judges disagree on identical output |

## Open questions

1. Human approval gates between tasks?
2. OS support on day one: macOS only?
3. Per-task agent budget (tokens, time, cost)?

## Build order

1. Engine core: schema, event log, scheduler, command tasks, needs, parallelism. Done when a diamond graph runs and replay gives the same state.
2. Resume: kill mid-run, restart, finished tasks not rerun.
3. Conditions (exit, expr) and loops (retry, repeat) with tests.
4. Agent tasks and spawn: Claude Code and Cursor CLI adapters.
5. Web UI: run view, then graph editor with YAML sync.
6. Sandboxing and agent-judge conditions.
