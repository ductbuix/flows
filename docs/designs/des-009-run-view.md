---
id: DES-009
title: "UI: run view"
type: ui
status: draft
summary: Run view screen with runs list, live task states, attempts, logs, outputs and spawned tasks over the websocket.
tags: [ui, web, runs, logs]
related: [DES-002, DES-003, DES-004, DES-005, DES-006, DES-008]
updated: 2026-11-20
---

# UI: run view

Screen for BL-008. It shows what the engine is doing, live. Read-only in
this step except where noted. Follow [DES-008](des-008-ui.md) for the UI
system. Everything shown here comes from the engine model in
[DES-003](des-003-engine.md) and the files in
[DES-002](des-002-workflow-files.md).

## What it must show

- The runs of a workflow, newest first, with run status and start time.
- For one run: every task with its state (`pending`, `ready`, `running`,
  `succeeded`, `failed`, `skipped`), including tasks spawned at runtime
  ([DES-005](des-005-agents-spawn.md)), marked as spawned.
- Progress: tasks finished out of the current total. The total can grow
  while the run is live because of spawn.
- For one task: its attempts (`attempt-<n>`: pid, exit code, start, end,
  `interrupted` when resume could not re-attach), and whether each launch
  was a retry or a repeat ([DES-004](des-004-conditions-loops.md)).
- For one attempt: `stdout.log` and `stderr.log` streaming, its
  `SUMMARY.md`, and the files in `out/`.
- Why a task was skipped (its `when` was false, or an upstream skip
  propagated) and why a task failed (exit code, timeout).
- Spawn rejections fed back to an agent, on the agent task.
- A warning badge when the run is not sandboxed
  ([DES-006](des-006-sandboxing.md)).
- Websocket connection state.

## Layout

```
+-----------+---------------------------------------------------+
| Sidebar   | Breadcrumb: workflow / run / task                 |
| workflows | Run header: status, progress, sandbox badge       |
|  > runs   +----------------------+----------------------------+
|           | Task list            | Task detail (tabs)         |
|           | (Resizable panel)    | Logs | Attempts | Summary  |
|           |                      | Output | Spawn            |
+-----------+----------------------+----------------------------+
```

## Components

shadcn components (add with `pnpm dlx shadcn@latest add <name> -c apps/web`):

| Need                                      | Component                |
| ----------------------------------------- | ------------------------ |
| App shell and workflow and run navigation | Sidebar, Breadcrumb      |
| Runs list and task list                   | Table, Badge             |
| Task list and detail split                | Resizable, Scroll Area   |
| Run progress                              | Progress                 |
| Task detail sections                      | Tabs                     |
| stdout or stderr switch                   | Toggle Group             |
| Exit codes, skip and fail reasons         | Alert, Tooltip           |
| Sandbox warning                           | Badge, Tooltip           |
| Empty, loading                            | Empty, Skeleton, Spinner |
| Websocket lost, request failed            | Alert                    |
| Attempt metadata rows                     | Item                     |

AI Elements patterns (copy from
`https://ui.shadcn.com/docs/ai-elements/base/<pattern>.md`; keep the
presentational parts and drop the chat and AI SDK wiring, since data
comes from our server):

| Need                                   | Pattern   | Builds on                |
| -------------------------------------- | --------- | ------------------------ |
| Attempt log output as it streams       | Terminal  | Trace, Code Block        |
| Attempts of a task as steps            | Task      | Trace                    |
| Files in `out/`                        | File Tree | per its page             |
| Agent tasks and the tasks they spawned | Subagent  | Trace, Code Block, Badge |

## States

| State                 | What shows                                                        |
| --------------------- | ----------------------------------------------------------------- |
| No runs yet           | Empty with a short line about starting a run                      |
| Loading run           | Skeleton rows in the task list and header                         |
| Run live              | task states and logs update from websocket events                 |
| Websocket lost        | Alert in the run header; data stays, marked stale until reconnect |
| Request failed        | Alert with the server error text                                  |
| Task with no attempts | Empty in the Attempts tab ("not started")                         |
| Log empty             | Empty in the Logs tab                                             |
| Missing `SUMMARY.md`  | Alert in the Summary tab (the engine warns, DES-002)              |

## Data contracts (proposed)

Final shapes are zod schemas in `packages/shared`, written in BL-004 and
BL-008. Names below are placeholders to agree on, not decisions.

- `GET /api/workflows/:workflowId/runs`: run summaries (id, status,
  started, finished, task counts).
- `GET /api/runs/:runId`: the frozen graph from `graph.json` (spawned
  tasks included, flagged) and the current state of each task.
- `GET /api/runs/:runId/tasks/:taskId/attempts/:n/log?stream=stdout&offset=`:
  log text from a byte offset, for the first load and for catching up.
- `GET /api/runs/:runId/tasks/:taskId/attempts/:n/summary` and `.../out`:
  `SUMMARY.md` text and the `out/` file list.
- `/api/ws`: the client subscribes to a run and gets engine events in
  log order with a sequence number, plus log chunks. Event kinds come
  from the engine (BL-004). The web folds events the same way the engine
  does, so the view equals a replay.

## Test ids

`run-list`, `run-row-<runId>`, `run-status`, `run-progress`,
`sandbox-badge`, `ws-status`, `task-row-<taskId>`, `task-state-<taskId>`,
`task-spawned-<taskId>`, `task-tab-<logs|attempts|summary|output|spawn>`,
`attempt-row-<n>`, `log-output`.

## Playwright evidence

- One e2e test runs a small fixture workflow (the BL-004 diamond) through
  the server, opens the run, and waits until every `task-state-*` reads
  `succeeded`, then checks `log-output` shows a known line.
- One test for a failing task (non-zero exit) showing the failure reason.
- Video and screenshots go in the PR (`pnpm test:e2e`).

## Open questions

1. Run controls: should this screen start, cancel or rerun a run, or
   retry a task? The design does not say. Read-only until decided.
2. Task list or a read-only graph (React Flow) for the run, or both?
3. How should `SUMMARY.md` render: plain text in a Code Block, or
   markdown? Markdown needs a renderer that is not in shadcn.
4. How far back to keep runs in the list, and is there run deletion?
5. How does e2e point the app at a temporary `~/.flowapp`? Needs a config
   option or env var that the design does not define yet.
6. Should repeat attempts and retry attempts look different?
