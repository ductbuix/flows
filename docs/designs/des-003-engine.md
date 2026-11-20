---
id: DES-003
title: Task lifecycle, engine and concurrency
type: design
status: active
summary: Task and run states (approval gates, cancelled), append-then-act event log, resume, run deletion and limits.
tags: [engine, lifecycle, events, resume, concurrency, approval]
related: [DES-001, DES-004, DES-005]
updated: 2026-11-21
---

# Task lifecycle, engine and concurrency


## Task lifecycle

`pending -> ready -> running -> (condition) -> succeeded | failed`, with
`pending -> skipped` when `when` is false and `running -> running` for
retry or repeat. Skips propagate unless a dependant allows `skipped`. A
failure fails the run unless `continueOnError`.

A task with an approval gate goes `ready -> awaiting_approval` and waits.
Approve moves it to `running`; reject ends it `failed` with reason
`rejected`, which then follows the normal failure rules.

Cancelling a run moves every task that has not finished (`pending`,
`ready`, `awaiting_approval`, `running`) to `cancelled`. Running attempts
are stopped by ending their process group. `succeeded`, `failed`,
`skipped` and `cancelled` are terminal.

Run states: `running`, then `succeeded`, `failed` or `cancelled`. A run
with a task in `awaiting_approval` stays `running`; the UI shows that it
is waiting.

## Approval gates

- Declared per task with `approval: true` in `workflow.yaml`
  ([DES-002](des-002-workflow-files.md)). The gate sits before the task's
  first launch; retries and repeats do not ask again.
- Approve and reject come from the UI (DES-011) and are events, so a gate
  survives a restart: replay leaves the task in `awaiting_approval`.
- A waiting task holds no concurrency slot.

## Engine

1. Append, then act: every change is an event written in a transaction
   before its side effect.
2. State is a fold over events; the scheduler keeps no state outside the
   log.
3. Each event triggers a tick: compute ready tasks, apply limits, spawn
   processes (detached, own process group), stream logs to files and the
   websocket.
4. Resume: replay the log; for started attempts with no exit, re-attach by
   pid if alive, else record `interrupted` and apply retry policy. Finished
   tasks never rerun.
5. Attempt ids are written before launch so a crash cannot start a
   duplicate.
6. Deleting a run appends a run deleted marker event and only then
   removes `runs/<runId>/`. The log keeps the run's events; the fold
   hides deleted runs from every view. If the process dies between the
   event and the removal, resume finishes the removal.

## Event kinds (BL-004, BL-005, BL-006, BL-007, BL-014)

Schemas live in `packages/shared`. The fold and the UI use the same set.

| Type                  | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `run_started`         | Run created; payload includes the frozen `graph`           |
| `approval_requested`  | Gated task entered `awaiting_approval`                     |
| `task_approved`       | Human approved; next tick may launch                       |
| `task_rejected`       | Human rejected; task `failed` with reason `rejected`       |
| `attempt_started`     | Attempt id recorded before launch (append-then-act)        |
| `attempt_launched`    | Process spawned; includes `pid` and `sandboxed` (DES-006)  |
| `attempt_finished`    | Process exited; includes `exitCode`                        |
| `attempt_interrupted` | Resume could not re-attach; no reliable exit code          |
| `task_succeeded`      | Scheduler ended a looping or spawn task as succeeded       |
| `task_failed`         | Scheduler ended a looping task as failed                   |
| `task_skipped`        | `when` false, branch miss, or upstream skip                |
| `tasks_spawned`       | Agent added tasks to this run's graph (DES-005)            |
| `cancel_requested`    | Cancel begun; stop scheduling, end process groups          |
| `task_cancelled`      | Unfinished task moved to `cancelled`                       |
| `run_cancelled`       | Run ended `cancelled`                                      |
| `run_succeeded`       | Every task terminal and none hard-failed                   |
| `run_failed`          | At least one hard failure (no ready work left)             |
| `run_deleted`         | Marker before removing `runs/<runId>/`; fold hides the run |

Each launch wraps the command so it writes `exit.code` under the attempt
dir. On resume, a dead pid with that file becomes `attempt_finished`;
otherwise `attempt_interrupted`. With a `retry` policy, interrupt stays
`running` and the scheduler retries (DES-004); without it, the task
fails. A terminal task status is never overwritten (so a late
`attempt_finished` after cancel stays `cancelled`).

## Concurrency

Nested limits: global, workflow, run, task group. A task starts only when
it fits under every level. Agent tasks also count against an `agents`
limit at each level. Global limits live in `~/.flowapp/config.yaml`,
workflow limits in `workflow.yaml` ([DES-002](des-002-workflow-files.md)).
