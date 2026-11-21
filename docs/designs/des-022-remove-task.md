---
id: DES-022
title: Remove a task in the editor
type: design
status: active
summary: Delete one task from the drawer or canvas, confirm, undo before save, and move its folder to tasks/.trash on save.
tags: [editor, yaml, files, ui]
related:
  [
    DES-002,
    DES-007,
    DES-010,
    DES-013,
    DES-020,
    DES-021,
    BL-023,
    BL-024,
  ]
updated: 2026-11-21
---

# Remove a task in the editor

`removeTask` already drops a task from `workflow.yaml` and removes
`needs` entries that pointed at it, including object needs and their
conditions. `applyWorkflowDiff` already calls it when a task id
disappears. The editor has no delete control, no canvas key handler,
no undo stack, and the workflow PUT only writes yaml. Deleting a
task today leaves `tasks/<id>/` in place (DES-020).

This design adds the delete affordances, a confirm dialog, undo
before save, and a folder move to `tasks/.trash/` on save.

## Affordances

A danger-style Delete task button sits at the bottom of the node
drawer. Delete or Backspace also starts a delete when a single
canvas node is selected, and not while typing in an input, textarea,
contenteditable, or the CodeMirror YAML pane.

Both paths open the same confirm dialog. The title is the task's
`name`, falling back to `id`. The body lists dependents the same
way (tasks whose `needs` point at it). If nothing depends on it,
the dialog says so. Confirming applies `removeTask` to the editor
yaml. The change is a pending edit until Save, like every other
editor change.

One task at a time. The canvas does not multi-select
(`multiSelectionKeyCode` is off). React Flow's default
`deleteKeyCode` is turned off, so a key press cannot remove a node
from the graph without updating the yaml.

A workflow must keep at least one task (existing schema). The
button is disabled, and the key is ignored, when only one task
remains. The tooltip says a workflow needs at least one task.

## Dependents and leftover files

Dependents just lose the link, which is today's `removeTask`
behavior. Need-conditions on that edge go away with the need.

On Save, the server also moves leftover judge files
`tasks/<dependent>/need-<removedId>.md` into the same trash folder
as the removed task (see below). Missing files are skipped. `when.md`
and `until.md` stay with the dependent; they do not belong to the
removed edge.

## Warn-only mentions

The confirm dialog warns, and does not block, when another task's
`run` string or `prompt.md` text mentions the removed task's
`UPSTREAM_<mapped id>` env var (DES-020) or the task id itself.
Unreadable prompt files are skipped. The same check runs on Save
(for a raw YAML edit that skipped the dialog) and shows a toast
after a successful save if mentions remain. The server does not
validate this.

## Undo before save

The editor has no undo today (`EditorState` holds one yaml string).
Add a bounded snapshot stack of `{ yaml, selectedTaskId }` in the
editor hook, used for every graph and inspector mutation, including
delete. The YAML pane keeps CodeMirror's own undo and does not
push on each keystroke.

Cmd/Ctrl+Z restores the previous snapshot. Cmd/Shift+Z and Ctrl+Y
redo. Keyboard undo and redo are ignored while focus is in an
input, textarea, contenteditable, or CodeMirror. The stack is
capped at 50 snapshots. A successful save clears it, so undo
cannot put a removed id back into yaml after the folder has
moved. Reload and conflict "use disk" also clear it.

## Save and `tasks/.trash/`

The PUT body stays `{ yaml, baseHash }`. The server derives
removed ids by diffing task ids in the disk yaml against the new
yaml, so a raw YAML edit and the drawer follow the same path.
There is no client-sent list.

`isSafeTaskId` today allows `.trash` (it is a single path
segment). It will also reject any id that starts with `.`, so
`.trash` cannot be a task id and later hidden folders stay safe.

The files API (`isAllowedWorkflowFilePath`) will reject any path
whose first two segments are `tasks` and `.trash`, so trash is
not listed or edited in the app.

Trash naming: `tasks/.trash/<id>-<YYYYMMDDTHHMMSSZ>/`. If that
name exists (a later save of a re-added id, or two saves in the
same second), append `-1`, `-2`, and so on. The removed task
folder `tasks/<id>/` moves into that directory as-is. Leftover
`need-<id>.md` files from dependents move to
`tasks/.trash/<id>-<stamp>/from/<dependentId>/need-<id>.md`.
If the task folder is missing, that move is skipped. If only
leftover need files exist, the trash directory is still created
for them.

PUT order:

1. Hash check (existing 409 conflict).
2. Parse and validate the new yaml (existing 400).
3. Diff task ids. If a removed id appears in any live or queued
   run's frozen graph as an authored task (no `promptDir`),
   return 409 `{ error: "task_in_live_run", taskIds, runIds }`
   and write nothing. This matches the live/queued meaning in
   DES-021.
4. Write `workflow.yaml`.
5. Move folders and leftover need files. Missing sources are
   skipped. If a move fails after the yaml is written, the
   handler returns 500 and names the path; the next save retries
   any `tasks/<id>/` that is still present for an id not in the
   yaml. Moves are not rolled back, because the yaml is already
   the source of truth.

Authored agent tasks read `tasks/<id>/prompt.md` from the
workflow folder at launch, not from a copy in the run
(`taskPromptAbs` in the engine). Spawned tasks are safe: they
use `promptDir` under the run. A live or queued run that still
has to launch an authored task would break if its folder moved,
so step 3 blocks that save. The editor may still hold a pending
delete; Save fails until those runs finish or are cancelled.

Past runs keep their `graph.json`, outputs and logs, so the run
view is unchanged. Retry of a finished authored agent task after
its folder was trashed can fail with `missing_prompt`. Restore
the folder from trash to retry. This cut does not snapshot
prompts into the run at start (ledger).

`.trash` is not emptied automatically. There is no restore UI
in this cut; the user can move a folder back by hand and put
the task back into the yaml.

## Impact map

| Area | What changes |
| ---- | ------------ |
| Shared | `isSafeTaskId` rejects a leading `.`; files allowlist rejects `tasks/.trash/...`; `removeTask` is unchanged |
| Server | `writeWorkflowYaml` diffs ids, blocks live or queued use, writes yaml, then moves folders |
| Web | Delete button, canvas keys, confirm and mention warning, last-task guard, snapshot undo and redo, React Flow default delete off |
| Tests | id and allowlist cases; PUT moves, skip, collision suffix, live 409, retry of leftover folders; Playwright for button, key, confirm, undo, last task (videos and screenshots on the UI item) |
| Docs | DES-002, 007, 010, 013, 016, 017, 020 |

## Out of scope

Multi-select delete, auto-purge of `.trash`, a restore UI, and
snapshotting prompts into the run at start.
