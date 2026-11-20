---
id: DES-001
title: Overview and domain model
type: design
status: active
summary: What Flows is, the stack, and the core entities (workflow, task, run, attempt, event).
tags: [overview, domain, stack]
related: [DES-002, DES-003, DES-008]
updated: 2026-11-20
---

# Overview and domain model

Local web app where a user builds workflows of tasks. Each task is an OS
process (command, node, python, or an AI agent CLI). Runs on one machine,
bound to 127.0.0.1.

## Stack

- `apps/web`: Vite, React, shadcn (preset `b1HvWXNDFK`), React Flow later.
  UI rules: [DES-008](des-008-ui.md).
- `apps/server`: Hono on `@hono/node-server`, websockets for live events,
  typed RPC client (`hc<AppType>`) shared with web.
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

A first agent is a task with `kind: agent`. Many instances means several
agent tasks or a `matrix`. A user has many workflows.

## Where the rest lives

- Files on disk and `workflow.yaml`: [DES-002](des-002-workflow-files.md)
- Lifecycle, engine, concurrency: [DES-003](des-003-engine.md)
- Conditions and loops: [DES-004](des-004-conditions-loops.md)
- Agents and runtime spawn: [DES-005](des-005-agents-spawn.md)
- Sandboxing: [DES-006](des-006-sandboxing.md)
- Trade-offs and open questions: [DES-007](des-007-tradeoffs.md)
- Build order: the backlogs, see [backlogs index](../backlogs/INDEX.md)
