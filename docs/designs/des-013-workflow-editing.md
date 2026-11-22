---
id: DES-013
title: "UI: workflow files, sync, lifecycle and memory"
type: ui
status: active
summary: Disk change detection and conflict dialog, workflow create, rename and delete, memory file editing, YAML-preserving writes.
tags: [ui, web, editor, yaml, files]
related:
  [
    DES-002,
    DES-005,
    DES-010,
    DES-012,
    DES-018,
    DES-020,
    DES-021,
    DES-022,
    DES-031,
  ]
updated: 2026-11-22
---

# UI: workflow files, sync, lifecycle and memory

> Superseded in part by [DES-031](des-031-node-workflows.md) (node workflows, 2026-11-22): the PUT shape and task id diff now cover nodes, edges, node folders and a separate layout write ([DES-033](des-033-workflow-file-v2.md)). Comment-keeping writes stay.

Part of the editor ([DES-010](des-010-graph-editor.md)). Paths are from
[DES-002](des-002-workflow-files.md): each workflow lives in
`workflows/<workflowId>/` under the app home.

## Changes on disk

`workflow.yaml` and `memory/*.md` can change outside the app (another
editor, an agent, git). The server watches the open workflow's dir and
sends a websocket message with the changed path and its content hash. It
ignores changes whose hash matches its own last write.

- No unsaved edits: reload from disk and show a Toast ("Reloaded from
  disk").
- Unsaved edits: open a Dialog, "workflow.yaml changed on disk", with:
  - **Reload from disk**: discard my edits.
  - **Keep mine**: keep editing; the next save overwrites the disk file.
  - **Show diff**: side by side CodeMirror merge view (DES-012) of disk
    and mine, then the same two choices.
- Saves send the hash the editor loaded. If the disk changed in between,
  the server answers `409` and the same Dialog opens. A save never
  silently overwrites a change it has not shown.

## Workflow lifecycle

All three actions are blocked while any run of the workflow is live; the
disabled button's Tooltip says so.

**Create.** Inputs: id (lowercase letters, digits and dashes; unique; it
becomes the dir name) and goal. Creates `workflows/<id>/` with
`workflow.yaml`, empty `memory/`, `input/` and `output/`.

**Rename.** The design has one name, the workflow `id`, which is also the
dir name. Rename changes both. Alert Dialog warning:

- The dir moves from `workflows/<old>/` to `workflows/<new>/`, with its
  runs, inputs, outputs and memory.
- `id:` in `workflow.yaml` changes (written with the Document API, so the
  rest of the file is untouched).
- Past runs stay in history under the new id, but paths recorded inside
  them (logs, `SUMMARY.md`, task outputs, `WF_DIR`) still point to the old
  dir.
- Scripts or tools outside the app that use the old path stop working.

**Delete.** Destructive Alert Dialog listing what goes:

- The whole dir `workflows/<id>/`: `workflow.yaml`, `memory/`, `input/`,
  `output/`, `SUMMARY.md` and every run under `runs/` with all attempts,
  logs and outputs.
- Its run history in the app.
- Cannot be undone. The dialog shows the run count and asks the user to
  type the workflow id to confirm.

## Memory files

`memory/*.md` are the initial memories for agent tasks; a task lists them
in `memory:` and the engine copies them into the attempt's `input/memory/`
at launch ([DES-005](des-005-agents-spawn.md)).

- List, create, edit (plain textarea; see [DES-018](des-018-agent-kind-and-file-editing.md)),
  rename and delete files in `memory/`. Import a `.md` file from disk
  with a native file picker; on name collision, overwrite or rename.
- Edits apply to future launches only. Running and past attempts keep the
  copy they got. The editor says this under the file name.
- Rename or delete warns with the tasks whose `memory:` list names the
  file. After a delete those tasks fail validation until fixed; after a
  rename the editor offers to update the references.
- File names: `.md`, no path separators, unique in `memory/`.

## YAML writes keep comments and key order

Graph and form edits never rebuild the file. The web (or server) keeps a
`yaml` `Document` from `parseDocument(text)`, applies each change with
`setIn`, `addIn` or `deleteIn`, and writes `doc.toString()`. Task ids
are not renamed in the editor (DES-020). The same Document writes add,
edit, and remove `inputs:` entries and change
`limits.maxConcurrentRuns` (DES-021).

Test plan (unit tests on the module that applies edits):

- Fixture with a header comment, inline comments, a comment between
  tasks, keys in a non-default order, and both flow (`{ max: 2 }`) and
  block maps.
- Apply: add a task, remove a task, change `name`, change `needs`,
  change `retry.max`, add `approval: true`, add an `inputs:` entry,
  change `limits.maxConcurrentRuns`.
- Assert every comment is still present, lines of untouched tasks are
  byte-identical, key order of untouched maps is unchanged, and the
  result parses to the expected object.
- A round trip with no edits returns the input exactly.

## Components

| Need                       | Component                             |
| -------------------------- | ------------------------------------- |
| Conflict choice and diff   | Dialog, Button, CodeMirror merge view |
| Rename and delete warnings | Alert Dialog, Alert                   |
| Create and rename forms    | Field, Input, Textarea                |
| Typed confirm for delete   | Input in the Alert Dialog             |
| Memory file list           | Item, Dropdown Menu                   |
| Results                    | Toast                                 |

## Data contracts

Zod schemas in `packages/shared` (`api-lifecycle.ts`).

- `POST /api/workflows` with `{ id, goal }` → `201`
- `POST /api/workflows/:workflowId/rename` with `{ newId }`; `409` while
  live or if the new id exists
- `DELETE /api/workflows/:workflowId`; `409` while live
- `PUT /api/workflows/:workflowId` with `{ yaml, baseHash }`; `409`
  on a changed disk file, or `409` `task_in_live_run` when the yaml
  removes a task that a live or queued run still needs. After a
  successful write, removed `tasks/<id>/` folders move to
  `tasks/.trash/` ([DES-022](des-022-remove-task.md))
- `GET /api/workflows/:workflowId/memory`, `GET`/`PUT`/`DELETE`
  `.../memory/:file`, and `POST .../memory/:file/rename` with
  `{ newName, updateReferences? }`
- `GET`/`PUT /api/workflows/:workflowId/files/*` for prompt files and
  other workflow-relative text files ([DES-018](des-018-agent-kind-and-file-editing.md),
  [DES-020](des-020-fixed-prompt-files.md)). Paths under
  `tasks/.trash/` are rejected ([DES-022](des-022-remove-task.md))
- Websocket: file changed `{ workflowId, path, hash, content }`

## Test ids

`workflow-create`, `workflow-rename`, `workflow-delete`,
`delete-confirm-input`, `conflict-dialog`, `conflict-reload`,
`conflict-keep`, `conflict-diff`, `memory-list`, `memory-row-<file>`,
`memory-editor`, `memory-save`, `memory-remove`, `memory-pick`,
`memory-collision`.

## Playwright evidence

- Edit the YAML, change the file on disk from the test, check the
  conflict dialog, try each choice.
- Rename a workflow and check the dir moved and runs still list.
- Delete a workflow after typing its id; check the dir is gone.
- Edit a memory file and check the warning about future launches.
- Video and screenshots in the PR.
