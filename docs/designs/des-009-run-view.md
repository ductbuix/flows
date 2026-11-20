---
id: DES-009
title: "UI: run view"
type: ui
status: active
summary: Run view with list and graph views, live task states, attempts, logs, rendered SUMMARY.md, outputs and spawned tasks.
tags: [ui, web, runs, logs]
related:
  [DES-002, DES-003, DES-004, DES-005, DES-006, DES-008, DES-011, DES-012]
updated: 2026-11-21
---

# UI: run view

Screen for BL-008. It shows what the engine is doing, live. Run actions
(start, cancel, rerun, retry a task, delete a run) are in
[DES-011](des-011-run-controls.md). Follow [DES-008](des-008-ui.md) for
the UI system and [DES-012](des-012-ui-libraries.md) for libraries.
Everything shown comes from the engine model in
[DES-003](des-003-engine.md) and the files in
[DES-002](des-002-workflow-files.md).

## What it must show

- The runs of a workflow, newest first, with run status and start time.
  Runs are kept until the user deletes them (DES-011).
- For one run: every task with its state (`pending`, `ready`, `running`,
  `succeeded`, `failed`, `skipped`), including tasks spawned at runtime
  ([DES-005](des-005-agents-spawn.md)), marked as spawned.
- Progress: tasks finished out of the current total. The total can grow
  while the run is live because of spawn.
- For one task: its attempts (`attempt-<n>`: pid, exit code, start, end,
  `interrupted` when resume could not re-attach) and why each was launched
  (see "Attempt kinds").
- For one attempt: `stdout.log` and `stderr.log` streaming, its
  `SUMMARY.md` rendered as markdown, and the files in `out/`.
- Why a task was skipped (its `when` was false, or an upstream skip
  propagated) and why a task failed (exit code, timeout).
- Spawn rejections fed back to an agent, on the agent task.
- A warning badge when the run is not sandboxed
  ([DES-006](des-006-sandboxing.md)).
- Websocket connection state.

## Two views of a run

The run body switches between **List** and **Graph** with a Toggle Group
in the run header (`run-view-list`, `run-view-graph`). The choice is kept
in the URL (`?view=graph`) so a reload or a shared link keeps it.

- List: a Table of tasks in topological order, spawned tasks under the
  task that spawned them.
- Graph: read-only React Flow canvas laid out with dagre (DES-012). Nodes
  show task id, state and attempt count; edges are `needs`, labeled when
  they carry a condition. No dragging, no editing; pan and zoom only.
- Selection is shared: selecting a task in either view opens it in the
  detail panel and stays selected after switching (`?task=<taskId>`).

## Layout

```
+-----------+---------------------------------------------------+
| Sidebar   | Breadcrumb: workflow / run / task                 |
| workflows | Run header: status, progress, sandbox badge,      |
|  > runs   |   List|Graph toggle, run actions (DES-011)        |
|           +----------------------+----------------------------+
|           | Task list or graph   | Task detail (tabs)         |
|           | (Resizable panel)    | Logs | Attempts | Summary  |
|           |                      | Output | Spawn            |
+-----------+----------------------+----------------------------+
```

## Attempt kinds

Each attempt shows why it was launched, with an icon and a text label so
the meaning never depends on color alone. Icons are lucide.

| Kind                                | Label          | Icon        | Badge variant      |
| ----------------------------------- | -------------- | ----------- | ------------------ |
| first launch                        | `Run`          | `Play`      | `outline`          |
| retry after failure or timeout      | `Retry 2/3`    | `RotateCcw` | `destructive` tint |
| repeat until a condition passes     | `Repeat 3/5`   | `Repeat`    | `secondary`        |
| retry started by the user (DES-011) | `Manual retry` | `Hand`      | `outline`          |
| interrupted by a restart            | `Interrupted`  | `Unplug`    | `outline`          |

The counter is the count for that loop and its `max`
([DES-004](des-004-conditions-loops.md)); retry and repeat counters are
separate. The badge has an `aria-label` with the full sentence, for
example "Retry 2 of 3 after exit code 1".

## Components

shadcn components (add with `pnpm dlx shadcn@latest add <name> -c apps/web`):

| Need                                      | Component                |
| ----------------------------------------- | ------------------------ |
| App shell and workflow and run navigation | Sidebar, Breadcrumb      |
| Runs list and task list                   | Table, Badge             |
| List and Graph switch                     | Toggle Group             |
| Task list and detail split                | Resizable, Scroll Area   |
| Run progress                              | Progress                 |
| Task detail sections                      | Tabs                     |
| stdout or stderr switch                   | Toggle Group             |
| Exit codes, skip and fail reasons         | Alert, Tooltip           |
| Sandbox warning                           | Badge, Tooltip           |
| Empty, loading                            | Empty, Skeleton, Spinner |
| Websocket lost, request failed            | Alert                    |
| Attempt metadata rows                     | Item                     |
| Fenced code in `SUMMARY.md`               | Code Block               |

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

Other libraries: React Flow and dagre for the graph view, react-markdown
with remark-gfm for `SUMMARY.md` (DES-012).

## States

| State                 | What shows                                                        |
| --------------------- | ----------------------------------------------------------------- |
| No runs yet           | Empty with a Start run action (DES-011)                           |
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
  tasks included, flagged) and the current state of each task, with each
  attempt's kind and loop counters.
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
`run-view-list`, `run-view-graph`, `run-graph`, `sandbox-badge`,
`ws-status`, `task-row-<taskId>`, `task-node-<taskId>`,
`task-state-<taskId>`, `task-spawned-<taskId>`,
`task-tab-<logs|attempts|summary|output|spawn>`, `attempt-row-<n>`,
`attempt-kind-<n>`, `log-output`, `summary-markdown`.

## Playwright evidence

- E2e runs against a temporary app home (`FLOWAPP_HOME`, DES-002).
- Run a small fixture workflow (the BL-004 diamond), open the run, wait
  until every `task-state-*` reads `succeeded`, check `log-output` shows a
  known line and `summary-markdown` renders a heading and a table.
- Switch to the graph view, check the selected task stays selected.
- A failing task shows its failure reason and a `Retry` attempt badge.
- Video and screenshots go in the PR (`pnpm test:e2e`).
