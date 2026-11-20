---
id: DES-011
title: "UI: run controls and run deletion"
type: ui
status: active
summary: Start, cancel, rerun, retry, approve and reject actions plus manual run deletion, with confirms and contracts.
tags: [ui, web, runs, controls]
related: [DES-002, DES-003, DES-004, DES-009]
updated: 2026-11-21
---

# UI: run controls and run deletion

Actions on the run view ([DES-009](des-009-run-view.md)). Every action
goes through the server and becomes engine events ("append, then act",
[DES-003](des-003-engine.md)); the UI updates from those events, not from
the button click. Event names are fixed in BL-004; the ones below describe
meaning only.

## Actions

| Action       | Where                                  | Allowed when                                          | Confirm          | Effect (engine meaning)                                                                                                                    |
| ------------ | -------------------------------------- | ----------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Start run    | workflow header, runs Empty state      | workflow file is valid                                | no               | new run with a frozen graph from `workflow.yaml` (run created)                                                                             |
| Cancel run   | run header                             | run is live                                           | yes              | stop scheduling, end each running attempt's process group; unfinished tasks and the run end `cancelled` (cancel requested, then cancelled) |
| Rerun        | run header                             | run is not live                                       | no               | new run from the current `workflow.yaml`; the old run is kept                                                                              |
| Retry task   | task detail                            | task is `failed` or its last attempt is `interrupted` | no               | new attempt of that task with kind manual retry; its dependants go back to `pending`; a finished run becomes live again (retry requested)  |
| Approve task | task detail, run header waiting banner | task is `awaiting_approval`                           | no               | the task starts (approved)                                                                                                                 |
| Reject task  | same                                   | task is `awaiting_approval`                           | yes              | the task ends `failed` with reason `rejected` (rejected)                                                                                   |
| Delete run   | runs list row menu, run header menu    | run is not live                                       | yes, destructive | removes the run (see below)                                                                                                                |

Rules:

- Buttons that are not allowed are disabled with a Tooltip that says why
  (for example "Cancel the run before deleting it").
- Rerun uses the workflow as it is now, which may differ from the old
  run's frozen graph. The rerun button's Tooltip says so.
- A manual retry does not count against the task's `retry.max`
  ([DES-004](des-004-conditions-loops.md)); it shows as `Manual retry`.
- Every action is idempotent on the server: a double click or a resend
  must not start two runs or two attempts (use a client request id).

## Cancel confirm

Alert Dialog: "Cancel this run? Running tasks are stopped. Finished task
outputs are kept." Actions: Cancel run (destructive), Keep running.

## Reject confirm

Alert Dialog: "Reject this task? It ends as failed, and the run fails
unless the task has `continueOnError`." Actions: Reject (destructive),
Keep waiting.

## Delete run

Runs are kept until the user deletes one. Deleting a live run is blocked;
cancel it first.

Alert Dialog, destructive, with the run id and start time:

- Removes the run directory `runs/<runId>/`: `graph.json`, every task's
  `input/`, all `attempt-<n>/` dirs with `out/`, `SUMMARY.md`,
  `stdout.log` and `stderr.log` ([DES-002](des-002-workflow-files.md)).
- Hides the run from the runs list and history. The engine keeps the
  run's events in the log with a run deleted marker
  ([DES-003](des-003-engine.md)); only the files are removed.
- Does not touch the workflow's own `output/`, `input/`, `memory/` or
  `workflow.yaml`, even if a task copied files into `output/`.
- Cannot be undone.

The user types nothing; one destructive button ("Delete run") and a
cancel. After success, a Toast confirms and the view goes to the runs
list.

## Components

| Need                 | Component                     |
| -------------------- | ----------------------------- |
| Action buttons       | Button, Button Group          |
| Row and header menus | Dropdown Menu                 |
| Disabled reasons     | Tooltip                       |
| Confirms             | Alert Dialog                  |
| Results and errors   | Toast, Alert                  |
| In-flight state      | Spinner on the pressed button |

## Data contracts

Zod schemas in `packages/shared` (`requestIdBodySchema`,
`okResponseSchema`, `apiErrorSchema`, `startRunResponseSchema`).

- `POST /api/workflows/:workflowId/runs` with `{ requestId }`: start; returns `{ runId }`.
- `POST /api/runs/:runId/cancel` with `{ requestId }`: returns `{ ok: true }`.
- `POST /api/runs/:runId/rerun` with `{ requestId }`: returns the new `{ runId }`.
- `POST /api/runs/:runId/tasks/:taskId/retry` with `{ requestId }`
- `POST /api/runs/:runId/tasks/:taskId/approve` and `.../reject` with `{ requestId }`; `409` unless the task is waiting.
- `DELETE /api/runs/:runId` with `{ requestId }`: `409` while the run is live.

Every mutating body includes `requestId`; the server is idempotent on it
for the process lifetime. Errors come back as `{ error, message }` and
show in a Toast. Manual retry appends `task_retry_requested`
([DES-003](des-003-engine.md)).

## Test ids

`run-start`, `run-cancel`, `run-rerun`, `task-retry`, `task-approve`,
`task-reject`, `run-waiting`, `run-menu-<runId>`,
`run-delete`, `confirm-dialog`, `confirm-ok`, `confirm-cancel`.

## Playwright evidence

- Start a run, cancel it while a slow task runs, check the dialog text
  and that the run ends cancelled.
- Retry a failed task and check a `Manual retry` attempt appears.
- A gated task waits; approve it and it runs; reject another and it fails
  with reason `rejected`.
- Delete a finished run, check the dialog lists what is removed and that
  the run dir is gone on disk; check delete is disabled on a live run.
- Video and screenshots in the PR.

Engine states and events behind these actions are in DES-003.
