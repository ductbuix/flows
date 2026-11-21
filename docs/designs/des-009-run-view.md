---
id: DES-009
title: "UI: run view"
type: ui
status: active
summary: Run view with list and graph views, live task states, attempts, logs, rendered SUMMARY.md, outputs and spawned tasks.
tags: [ui, web, runs, logs]
related:
  [
    DES-002,
    DES-003,
    DES-004,
    DES-005,
    DES-006,
    DES-008,
    DES-011,
    DES-012,
    DES-021,
    DES-023,
    DES-024,
    DES-025,
  ]
updated: 2026-11-22
---

# UI: run view

Screen for BL-008 (done). It shows what the engine is doing, live. Run
actions (start, cancel, rerun, retry a task, delete a run) are in
[DES-011](des-011-run-controls.md). Follow [DES-008](des-008-ui.md) for
the UI system and [DES-012](des-012-ui-libraries.md) for libraries.
Everything shown comes from the engine model in
[DES-003](des-003-engine.md) and the files in
[DES-002](des-002-workflow-files.md).

## What it must show

- The runs of a workflow, newest first, with run status and start time.
  Runs are kept until the user deletes them (DES-011).
- For one run: every task with its state (`pending`, `ready`,
  `awaiting_approval`, `running`, `succeeded`, `failed`, `skipped`,
  `cancelled`; [DES-003](des-003-engine.md)), including tasks spawned at runtime
  ([DES-005](des-005-agents-spawn.md)), marked as spawned.
- Progress: tasks finished out of the current total. The total can grow
  while the run is live because of spawn.
- For one task: its attempts (`attempt-<n>`: pid, exit code, start, end,
  `interrupted` when resume could not re-attach) and why each was launched
  (see "Attempt kinds").
- For one attempt: `stdout.log` and `stderr.log` streaming, its
  `SUMMARY.md` rendered as markdown, and the files in `out/`. An
  agent attempt also shows the recorded `model`, `effort`, and
  source ([DES-023](des-023-model-effort.md)).
- Why a task was skipped (its `when` was false, or an upstream skip
  propagated) and why a task failed (exit code, timeout).
- Spawn rejections fed back to an agent, on the agent task.
- A warning badge when the run is not sandboxed
  ([DES-006](des-006-sandboxing.md)).
- A run waiting on an approval gate: the run header says so and links to
  the waiting tasks (actions in DES-011).
- Run status includes `queued` (DES-021). The header lists this run's
  frozen input files from `runs/<runId>/input/`. Text and markdown can
  be read in place; other files can be downloaded.
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

Waiting Confirmation or a failure Alert lead the page (DES-025). Plan
sits beside the task Table. Task detail is a Card with Tabs; the
selected tab is `?tab=` (default Output).

```
+-----------+---------------------------------------------------+
| Sidebar   | Breadcrumb: workflow / run                        |
|           | Confirmation or failure Alert (when needed)       |
|           | Run header: status, progress, sandbox, inputs,    |
|           |   List|Graph toggle, run actions (DES-011)        |
|           +----------------------+----------------------------+
|           | Plan | Task Table    | Task Card (tabs)           |
|           | (or graph)           | Output | Terminal |        |
|           |                      | Attempts | Environment     |
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
| Task detail sections                      | Tabs (`variant="line"`)  |
| Waiting approval / run failed             | Confirmation / Alert     |
| Exit codes, skip and fail reasons         | Alert, Tooltip           |
| Sandbox warning                           | Badge, Tooltip           |
| Empty, loading                            | Empty, Skeleton, Spinner |
| Websocket lost, request failed            | Alert                    |
| Attempt metadata rows                     | Item                     |
| Fenced code in `SUMMARY.md`               | Code Block               |

AI Elements patterns live in `apps/web/src/components/ai-elements/`
(copy from `https://ui.shadcn.com/docs/ai-elements/base/<pattern>.md`;
drop chat and AI SDK wiring). Base: `shadcn add trace code-block`.

| Need                              | Pattern         | Builds on         |
| --------------------------------- | --------------- | ----------------- |
| Default attempt log               | Terminal        | Trace, Code Block |
| Attempts as steps                 | Task            | Trace             |
| Retry plan progress               | Plan            | Trace             |
| Failed attempt                    | Stack Trace     | Trace             |
| Files in `out/`                   | File Tree       | Collapsible       |
| Trust and approve or reject       | Confirmation    | Item, Button      |
| Env, command, pid, raw stdout/err | Environment tab | Item, Code Block  |

Env uses Flows-owned path templates from the frozen graph (not a live
process dump). Tool, Reasoning and Subagent wait for a structured CLI
event log (DES-024).

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
| Log empty             | Empty in the Terminal tab                                         |
| Missing `SUMMARY.md`  | Alert in the Output tab (the engine warns, DES-002)               |

## Data contracts

Zod schemas live in `packages/shared` (`api.ts`, `attempt-kind.ts`).

- `GET /api/workflows`: workflow summaries from `FLOWAPP_HOME/workflows`.
- `GET /api/workflows/:workflowId/runs`: run summaries (id, status,
  started, finished, task counts), newest first.
- `POST /api/workflows/:workflowId/runs`: start a run (`{ runId }`). UI
  start controls are DES-011 / BL-012; the route exists so the run view
  and e2e can create runs.
- `GET /api/runs/:runId`: folded `RunDetail` (graph with spawned tasks
  flagged, task states, attempt kinds). The **server** folds with the
  engine; the web does not import the engine (DES-015).
- `GET /api/runs/:runId/tasks/:taskId/attempts/:n/log?stream=stdout&offset=`:
  log text from a byte offset, for the first load and for catching up.
- `GET /api/runs/:runId/tasks/:taskId/attempts/:n/summary` and `.../out`:
  `SUMMARY.md` text and the `out/` file list.
- `/api/ws`: the client sends `subscribe_run` / `subscribe_log`. The
  server pushes `engine_event` (with `seq`), `run_snapshot` (folded
  `RunDetail`), and `log_chunk`. Snapshots keep the view equal to a
  replay without shipping fold code to the browser.

## Test ids

`run-list`, `run-row-<runId>`, `run-status`, `run-progress`,
`run-view-list`, `run-view-graph`, `run-graph`, `sandbox-badge`,
`ws-status`, `task-row-<taskId>`, `task-node-<taskId>`,
`task-state-<taskId>`, `task-spawned-<taskId>`,
`task-tab-<logs|attempts|summary|output|spawn>`, `attempt-row-<n>`,
`attempt-kind-<n>`, `attempt-reason-<n>`, `attempt-model-<n>`,
`log-output`, `task-terminal`,
`advanced-switch`, `advanced-logs`, `advanced-env`, `advanced-command`,
`advanced-raw-log`, `attempts-task`, `attempts-plan`,
`attempt-stack-<n>`, `out-file-tree`, `task-confirmation`,
`summary-markdown`.

## Playwright evidence

- E2e runs against a temporary app home (`FLOWAPP_HOME`, DES-002).
- Run a small fixture workflow (the BL-004 diamond), open the run, wait
  until every `task-state-*` reads `succeeded`, check `log-output` shows a
  known line and `summary-markdown` renders a heading and a table.
- Switch to the graph view, check the selected task stays selected.
- A failing task shows its failure reason and a `Retry` attempt badge.
- Video and screenshots go in the PR (`pnpm test:e2e`).
