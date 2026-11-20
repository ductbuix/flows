---
id: DES-010
title: "UI: workflow list and graph editor"
type: ui
status: draft
summary: Workflow list and a React Flow graph editor kept in sync with workflow.yaml, plus promoting spawned tasks.
tags: [ui, web, editor, yaml]
related: [DES-001, DES-002, DES-004, DES-005, DES-008, DES-009]
updated: 2026-11-20
---

# UI: workflow list and graph editor

Screens for BL-009. Follow [DES-008](des-008-ui.md). `workflow.yaml` is
the source of truth ([DES-002](des-002-workflow-files.md)); the graph and
the file are two views of it and must stay in sync both ways.

## What it must show and do

- The user's workflows (a user has many), with id and goal.
- For one workflow, a graph: tasks are nodes, `needs` are edges.
- Per node: `id`, `kind` (`command` or `agent`), and markers for `matrix`,
  `spawn`, `retry`, `repeat` and `when`
  ([DES-004](des-004-conditions-loops.md)).
- Edges that carry a condition (branch edges, `when`) are labeled.
- Edit a task: kind, `run` or `cli` and `prompt`, `memory` files,
  `needs`, `when`, `retry`, `repeat`, `matrix`, `spawn`,
  `continueOnError`, limits.
- Edit workflow fields: `goal` and `limits` (`concurrency`, `agents`,
  `maxTasks`, `maxSpawnDepth`).
- The YAML text next to the graph. Editing either side updates the other.
- Validation errors from the workflow schema, on the field and in YAML.
- Promote a spawned task from a run ([DES-005](des-005-agents-spawn.md),
  [DES-009](des-009-run-view.md)) into `workflow.yaml`.

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
| YAML display with highlighting        | Code Block                             |
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
| Save failed          | Toast with the server error; edits kept                                   |
| File changed on disk | see open question 2                                                       |

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
`yaml-errors`, `save-button`, `promote-<taskId>`.

## Playwright evidence

- Add a task in the graph, connect it, save, and assert the YAML pane and
  the file on disk contain it.
- Edit YAML to rename a task and assert the node label changes.
- Break the YAML and assert `yaml-errors` shows and the graph is kept.
- Video and screenshots go in the PR.

## Open questions

1. YAML editing: a plain Textarea, or a code editor (CodeMirror or
   Monaco)? shadcn has no editor component; Code Block is display only.
2. When `workflow.yaml` changes on disk while the editor has unsaved
   edits: reload, merge, or ask?
3. Graph layout: automatic (for example dagre or elk) or saved positions?
   Positions are not in `workflow.yaml` today.
4. How to show `matrix` tasks: one node, or one node per value?
5. Is creating, renaming or deleting a workflow in scope, and editing
   `memory/*.md` files?
6. Keep YAML comments and key order when the graph writes the file?
