---
id: DES-018
title: "UI: agent kind switch and plain file editing"
type: ui
status: active
summary: "Fix switching a task to kind agent, and edit memory and instructions in a plain textarea, with a .md file picker."
tags: [ui, web, editor, agent, memory, files]
related: [DES-002, DES-005, DES-012, DES-013, DES-020, BL-015, BL-016]
updated: 2026-11-21
---

# UI: agent kind switch and plain file editing

Follow-up to the editor in [DES-013](des-013-workflow-editing.md). Two
changes: switching a task to `kind: agent` must produce a valid task, and
memory and prompt files are edited in a plain textarea.

The free `instructions` path in this doc is superseded by
[DES-020](des-020-fixed-prompt-files.md). The kind-switch rule (a valid
shape and field errors) still holds, except the agent default no
longer sets `instructions`.

## Agent kind: root cause

Confirmed by reading the editor, YAML edit helpers, schema and save
path. Not re-checked in a running browser. It matches the report that
switching worked and then save failed or showed an error.

1. The Kind select in `Inspector.tsx` calls
   `onChangeTask(task.id, { kind })` only. It does not set `cli` or
   `instructions`, and it does not drop `run`.
2. `yamlAfterTaskPatch` writes that patch with `setTaskField`, so the
   YAML becomes `kind: agent` while `run` stays and `cli` and
   `instructions` are missing.
3. `agentTaskSchema` requires `cli` (`claude` or `cursor`) and a
   non-empty `instructions` path. `parseWorkflowYaml` therefore returns
   `workflow: null` and schema errors.
4. `useWorkflowEditor` keeps the last valid workflow object when parse
   fails, so the Inspector can still show the old command task. The YAML
   pane shows the broken file and the errors. Save is disabled while
   those errors exist. If a save is sent anyway,
   `writeWorkflowYaml` rejects it with `400` and the toast is
   "Save failed: invalid YAML".
5. Those errors are listed only as YAML diagnostics, not next to the
   Inspector fields. Zod's discriminated union messages are often
   generic, so the missing `cli` or `instructions` is easy to miss.

## Agent kind: fix

Switching `kind` replaces the task with a valid shape for the new kind.
It does not merge the new `kind` onto the old fields.

Keep shared fields: `id`, `needs`, `approval`, `when`, `retry`,
`repeat`, `continueOnError`, and any engine stamps (`spawnDepth`,
`spawnedBy`) if present.

Defaults when switching to `agent`:

- `cli: claude`
- no `instructions` key; the prompt lives at `tasks/<id>/prompt.md`
  ([DES-020](des-020-fixed-prompt-files.md))
- drop `run`

Defaults when switching to `command`:

- `run: echo ok` (same as a newly added command task).
  `commandTaskSchema` requires `run` to be a non-empty string, so
  `run: ""` would still be invalid.
- drop `cli`, `memory` and `spawn`

The prompt file is not created by the kind switch. **Edit prompt**
creates it on first save (DES-020). Saving `workflow.yaml` is allowed
before that file exists. A run fails later with `missing_prompt` if
it is still missing.

After the switch, parse must succeed so the Inspector shows the new
kind and its fields. Apply the change with the Document API (replace
the task map in place, or a dedicated helper) so comments and key
order of other tasks stay as in DES-013.

Validation errors that remain (empty `run`, and so on) show next to
the Inspector field they belong to, mapped
from the parse diagnostic `path`. The YAML pane can still list them.
Save must not fail silently: keep the disabled state while errors
exist, and if the server returns `400`, show the field errors and the
existing toast.

## Plain textarea for workflow files

### Memory files

The memory editor stays a dialog, opened from the memory list. Replace
CodeMirror in `MemoryEditorDialog.tsx` with the shared `Textarea`
(plain text, same feel as a chat box). Keep an explicit **Save**. Add
**Remove** in the dialog, with the same confirm already used for
delete (tasks that reference the file are listed). **Cancel** closes
without writing.

Edits still apply to future launches only. Running and past attempts
keep the copy they got. The dialog keeps that sentence under the file
name. The `baseHash` conflict check stays: a `409` means the file
changed on disk; the user reloads and tries again.

Rename stays on the memory list, not in this dialog.

### Add a custom file from disk

A native file picker (`<input type="file" accept=".md">`) next to the
existing "Add" name field. Only `.md` files. The browser reads the
file and uploads its text with the existing
`PUT /api/workflows/:workflowId/memory/:file`.

The memory file name is the picked file's basename. If that name
already exists in `memory/`, open a short dialog:

- An input, prefilled with the basename, so the user can rename.
- **Overwrite** writes onto the existing name (no `baseHash`, same as
  today's create).
- **Add** writes under the edited name, and stays disabled if that
  name still collides.
- **Cancel** does nothing.

Do not invent a unique name automatically. Collision is handled in
the UI before the PUT; the memory endpoint does not change.

### Agent prompt

The Inspector no longer has a path field. **Edit prompt** opens the
same textarea dialog and creates `tasks/<id>/prompt.md` on first
save. See [DES-020](des-020-fixed-prompt-files.md). Saving a prompt
file does not by itself save `workflow.yaml`. The files API below
is unchanged.

### YAML pane

The YAML editor stays on CodeMirror 6 ([DES-012](des-012-ui-libraries.md)).
The conflict merge view does too. Only the memory and instructions
dialogs drop CodeMirror.

## Server: workflow-scoped files

`apps/server/src/memory-files.ts` already reads and writes a file with
a content hash and a `baseHash` conflict check, but it only allows a
`.md` basename under `memory/`. The smallest change is to extract that
I/O into a helper that resolves a path under the workflow dir, then
keep the memory module as a thin wrapper for list, rename and
reference updates. Instructions (and any later text file) use the
same helper.

New routes, sibling to the memory ones:

- `GET /api/workflows/:workflowId/files/*`
- `PUT /api/workflows/:workflowId/files/*` with
  `{ content, baseHash? }`

The splat is the workflow-relative path (`tasks/plan.md`). Response:
`{ path, content, hash }`. PUT without `baseHash` creates the file
when it is missing. PUT with `baseHash` keeps the conflict check and
returns `409` plus disk content and hash when it fails.

Path rules:

- Relative only. Reject absolute paths, backslashes, empty segments
  and `..`. After resolve, the file must still be inside the
  workflow dir.
- Reject `workflow.yaml` (it has its own endpoint) and any path under
  `runs/`.
- Prompt files use the fixed paths in DES-020, under `tasks/<id>/`.

No new delete route for these files. Memory delete stays on
`DELETE /api/workflows/:workflowId/memory/:file`.

## Components

| Need                           | Component                          |
| ------------------------------ | ---------------------------------- |
| Memory and instructions editor | Dialog, Textarea, Button           |
| Remove memory file             | Alert Dialog (existing confirm)    |
| Name collision on import       | Dialog, Input, Button              |
| Pick a .md file                | native `<input type="file">`       |
| Field errors on a task         | Field, text on the Inspector input |

## Data contracts

Zod schemas in `packages/shared`, next to `api-lifecycle.ts`.

- `GET` / `PUT /api/workflows/:workflowId/files/*` as above
- Existing memory routes are unchanged
- Kind-switch behaviour lives in the YAML edit helpers used by the
  editor; no new workflow save endpoint

## Test ids

`field-kind`, `field-cli`, `field-task-id`, `field-task-name`,
`field-prompt-path`, `edit-prompt`, `prompt-editor`, `prompt-save`,
`field-error-<name>`, `memory-editor`, `memory-save`,
`memory-remove`, `memory-pick`, `memory-collision`,
`memory-collision-overwrite`, `memory-collision-add`.

## Playwright evidence

- Switch a command task to agent, save, reload: YAML has `cli` and
  no `run` or `instructions`. Switch back: `run` is present,
  `cli`, `memory` and `spawn` are gone. Other tasks
  in the file are unchanged.
- Clear a required field and check the error on that Inspector field.
- Edit and save a memory file in the textarea; check the future-
  launches sentence. Remove a file from the dialog after confirm.
- Add a `.md` file with the picker; when the name exists, overwrite
  once and rename once.
- From an agent task, open **Edit prompt**, save a new file, reload,
  and check `tasks/<id>/prompt.md` on disk (DES-020).
- Video and screenshots with the UI work.
