---
id: DES-010
title: "UI: workflow list and graph editor"
type: ui
status: active
summary: Workflow list and React Flow graph editor synced with workflow.yaml (CodeMirror pane), auto layout, spawn marker.
tags: [ui, web, editor, yaml]
related:
  [
    DES-001,
    DES-002,
    DES-004,
    DES-005,
    DES-008,
    DES-009,
    DES-012,
    DES-013,
    DES-020,
    DES-021,
    DES-022,
    DES-023,
    DES-028,
  ]
updated: 2026-11-22
---

# UI: workflow list and graph editor

> Superseded in part by the UI renovation (draft, lands with BL-057 to BL-072): the editor layout; the Inspector becomes the task and workflow settings Sheets; see [DES-028](des-028-ui-renovation-screens.md).

Screens for BL-009 / BL-029. Follow [DES-008](des-008-ui.md) and
[DES-012](des-012-ui-libraries.md) for libraries. `workflow.yaml` is the
source of truth ([DES-002](des-002-workflow-files.md)); the graph and the
file are two views of it and must stay in sync both ways. File sync,
conflicts, workflow create, rename and delete, memory files and YAML
preservation are in [DES-013](des-013-workflow-editing.md).

## What it must show and do

- The user's workflows (a user has many), with id and goal, and create,
  rename and delete actions (DES-013).
- For one workflow, a graph: tasks are nodes, `needs` are edges.
- Per node: display `name` (falling back to `id`), `kind`
  (`command` or `agent`), and markers for `spawn`, `retry`,
  `repeat` and `when` ([DES-004](des-004-conditions-loops.md)).
- Edges that carry a condition (branch edges, `when`) are labeled.
- Edit a task: `name`, kind, `run` or `cli`, optional `model` and
  `effort` for agent tasks and lone agent judges
  ([DES-023](des-023-model-effort.md)), the fixed prompt file
  ([DES-020](des-020-fixed-prompt-files.md)), `memory` files, `needs`,
  `when`, `retry`, `repeat`, `spawn`, `continueOnError`, limits. The
  id is generated and is not editable in the drawer. A danger-style
  Delete task button, or Delete/Backspace on a selected canvas node,
  removes one task after a confirm (DES-022). That is a pending edit
  until Save. Cmd/Ctrl+Z undoes graph and inspector edits before
  save, including delete. The last task cannot be removed.
- Edit workflow fields: `goal`, `inputs` (name, type, required,
  description, default), `limits` (`concurrency`, `agents`,
  `maxTasks`, `maxSpawnDepth`, `maxConcurrentRuns`) (DES-021), and
  per-CLI agent defaults for `model` and `effort` (DES-023).
- The YAML text next to the graph in a CodeMirror 6 editor with YAML
  highlighting and inline diagnostics, shown only when Advanced is on
  (`flows-advanced`, DES-024). Editing either side updates the other.
  A parse error with Advanced off shows an Alert that opens Advanced.
- The workflow's `memory/*.md` files, editable (DES-013).
- Validation errors from the workflow schema, on the field and in YAML.
- Promote a spawned task from a run ([DES-005](des-005-agents-spawn.md),
  [DES-009](des-009-run-view.md)) into `workflow.yaml`.

## Graph rules

- Layout is automatic: dagre, left to right, recomputed on every change
  (DES-012). Nodes cannot be pinned and no positions are saved, so
  `workflow.yaml` stays the only file. Ledger entry in DES-007.
- There is no `matrix` key. Fan-out happens at runtime through spawn
  ([DES-005](des-005-agents-spawn.md)), so spawned tasks appear in the run
  view, not in the editor, unless promoted.

## Layout

```
+-----------+-----------------------------------+----------------+
| Sidebar   | Toolbar: add task, layout, save   | Inspector      |
| workflows +-----------------------------------+ (selected task |
|           | Graph canvas (React Flow)         |  or workflow)  |
|           |                                   |                |
|           +-----------------------------------+                |
|           | YAML pane (Resizable, collapsible)|                |
+-----------+-----------------------------------+----------------+
```

## Components

The graph uses React Flow (`@xyflow/react`). AI Elements did not rebuild
the canvas, node, edge, controls, panel and toolbar elements; its
migration notes say to build them with React Flow plus Card and Button
Group, which is what this does.

| Need                                  | Component                              |
| ------------------------------------- | -------------------------------------- |
| Workflow list and navigation          | Sidebar, Item                          |
| Task node on the canvas               | Card, Badge                            |
| Canvas toolbar and zoom controls      | Button Group, Button, Tooltip          |
| Graph, YAML and inspector panes       | Resizable                              |
| Task and workflow forms               | Field, Input, Textarea, Select, Switch |
| Picking `needs` and memory files      | Combobox                               |
| YAML editing                          | CodeMirror 6 (DES-012), not shadcn     |
| File conflict diff                    | Dialog with CodeMirror merge view      |
| Validation errors                     | Field errors, Alert                    |
| Promote spawned task, discard changes | Alert Dialog                           |
| Saved, save failed                    | Toast                                  |
| No workflows, loading                 | Empty, Skeleton                        |

## Sync model

- The server parses `workflow.yaml` with the shared zod schema and
  returns the text, the parsed workflow and any errors.
- A graph or form edit changes the parsed workflow; the web prints it
  back to YAML and the server validates and writes the file.
- A YAML edit is parsed; if valid, the graph updates; if invalid, the
  graph keeps the last valid state and shows the errors.
- Saving writes the file through the server only.

## States

| State                | What shows                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| No workflows         | Empty with a create action                                                |
| Loading              | Skeleton canvas and inspector                                             |
| YAML invalid         | Alert above the YAML pane, errors on fields; graph shows last valid state |
| Unsaved changes      | Save enabled; leaving asks with Alert Dialog                              |
| Delete a task        | Confirm lists dependents and mention warnings; applied on Save (DES-022)  |
| Save failed          | Toast with the server error; edits kept                                   |
| File changed on disk | ask the user, see DES-013                                                 |

## Data contracts (proposed)

Final shapes are zod schemas in `packages/shared`. Names are placeholders.

- `GET /api/workflows`: id, goal, updated.
- `GET /api/workflows/:workflowId`: YAML text, parsed workflow, errors.
- `PUT /api/workflows/:workflowId`: YAML text; returns parsed workflow or
  errors. Writes only inside the workflow dir.
- `POST /api/runs/:runId/tasks/:taskId/promote`: copies a spawned task
  spec into `workflow.yaml`.

## Test ids

`workflow-list`, `workflow-row-<id>`, `graph-canvas`, `node-<taskId>`,
`edge-<from>-<to>`, `inspector`, `field-<name>`, `yaml-pane`,
`yaml-errors`, `save-button`, `promote-<taskId>`, `delete-task`,
`delete-task-body` (with shared `confirm-dialog` / `confirm-ok` /
`confirm-cancel`).
Workflow and memory actions add their own ids in DES-013.

## Playwright evidence

- Add a task in the graph, connect it, save, and assert the YAML pane and
  the file on disk contain it.
- Edit a task's `name` (or the YAML `name`) and assert the node
  label changes.
- Break the YAML and assert `yaml-errors` shows and the graph is kept.
- Delete a task from the drawer and with Delete/Backspace, confirm
  dependents, undo, guard the last task, and save (DES-022).
- Video and screenshots go in the PR.

## Resolved questions

Answered on 2026-11-21:

1. YAML editor: CodeMirror 6, not a textarea (DES-012).
2. File changed on disk with unsaved edits: ask the user (DES-013).
3. Graph layout: automatic for now, no saved positions.
4. Matrix: dropped; fan-out is done by spawn (DES-005).
5. Workflow create, rename, delete and `memory/*.md` editing are in scope,
   with warnings on consequences (DES-013). Removing a task from the
   graph is in [DES-022](des-022-remove-task.md).
6. Graph writes keep YAML comments and key order (DES-013).
