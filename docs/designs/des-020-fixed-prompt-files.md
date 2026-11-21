---
id: DES-020
title: Fixed prompt files
type: design
status: draft
summary: Agent prompts and judge files live at fixed paths under tasks/<taskId>/; the instructions key is removed.
tags: [agents, yaml, editor, files, spawn]
related: [DES-002, DES-004, DES-005, DES-010, DES-013, DES-018, DES-019, BL-019, BL-020]
updated: 2026-11-21
---

# Fixed prompt files

The `instructions` key is a free path today. The Inspector lets the
user edit it, and it is easy for the yaml and the file to drift. This
design removes the key. Paths are derived from the task id and the
judge slot. `TASK_INSTRUCTIONS` keeps its name and points at the
derived file.

## Paths

In the workflow folder:

```
workflows/<workflowId>/
  workflow.yaml
  tasks/<taskId>/prompt.md      # agent task prompt
  tasks/<taskId>/when.md        # agent judge in `when`
  tasks/<taskId>/until.md       # agent judge in `repeat.until`
  tasks/<taskId>/need-<id>.md   # agent judge on a needs entry
```

Helpers in `packages/shared`, used by the server, engine and web:

- `taskPromptPath(taskId)` → `tasks/<taskId>/prompt.md`
- `judgePromptPath(taskId, slot)` → the slot file above

A task id must be a single path segment (no `/`, `\`, or `..`).
`parseWorkflowYaml` rejects an unsafe id with a clear error. No other
new abstraction.

## Workflow yaml

An agent task no longer has `instructions`. The engine derives the
path from the id. A command task has no prompt file and no
`instructions` field. `TASK_INSTRUCTIONS` is set only for agent
tasks.

```yaml
tasks:
  - id: plan
    kind: agent
    cli: claude
    spawn: true
  - id: check
    kind: command
    run: python check.py
    needs: [plan]
    repeat:
      until:
        any:
          - expr: "json('out/score.json').score >= 0.8"
          - agent: { cli: claude } # reads tasks/check/until.md
```

Any leftover `instructions` key, on a task or a judge, is a parse
error. The message tells the user to move the file to the derived
path (when that path can be computed) and to delete the key. There
is no auto-migration. The one known real workflow is
`~/.flowapp/workflows/implement-ticket` (`instructions: tasks/start.md`
on task `start`). That is fixed by hand: move the file to
`tasks/start/prompt.md` and drop the key.

## Inspector

The path input goes away. The label is **Prompt**. The button is
**Edit prompt**, always enabled. Muted text under it reads "Stored at
`tasks/<id>/prompt.md` in this workflow." If the file is missing, it
also says "Not created yet." **Edit prompt** opens the existing
textarea dialog (`FileEditorDialog`) and creates the file on first
save, through the files API from DES-018.

Kind switch to `agent` no longer writes an `instructions` field
(DES-018 still requires a valid shape: `cli: claude`, drop `run`).

The first UI cut is the agent task prompt only. The Inspector does
not yet edit `when` or `until`. Judge files can be written through
the files API. Revisit when the Inspector grows condition editors.

Test ids: `field-prompt-path`, `edit-prompt`, `prompt-editor`,
`prompt-save`.

## Rename and delete

Renaming a task moves `tasks/<old>/` to `tasks/<new>/`. The editor
tracks renames and sends them with the workflow PUT:
`{ yaml, baseHash, renames?: [{ from, to }] }`. The server applies
the folder moves in the same request as the yaml write, so the file
and the yaml never disagree.

It also renames `need-<old>` files to `need-<new>` in every task
folder, because a dependant's judge file is named after the upstream
id, which `renameTask` already updates in the yaml.

Order:

1. Validate `baseHash`, the new yaml, and every rename. If a target
   folder exists and the source still exists, return `409` and write
   nothing.
2. A missing source is fine (no prompt folder yet) and is skipped.
   A missing source with the target already present is treated as
   already applied (idempotent).
3. Apply the folder moves, then the `need-*` file renames, then
   write the yaml.
4. If the yaml write fails after moves, roll the moves back and
   return the yaml error. If rollback fails, return `500` and say
   the folders were moved and the yaml was not; a retry is
   idempotent.

Deleting a task does not delete its folder. Orphans are harmless.
Ledger: [DES-007](des-007-tradeoffs.md).

## Judges

The judge object is `{ cli }` only. The file is named by slot under
the owning task's folder, as above. At most one agent judge per
slot, including inside `all` / `any`. A second agent leaf in the
same slot is a schema error with a clear message. That is a
deliberate limit: one slot, one file. Revisit if a real workflow
needs two agent judges in one slot (DES-007).

A missing judge file makes that agent condition fail (false), the
same as a missing instructions file does today. The judge cache key
uses the derived path, the cli, and the attempt root.

## Spawn and promote

The spawner still writes `out/spawn/<id>.yaml`. For an agent (or a
task with an agent judge) it also writes the prompt and judge files
next to the spec, under `out/spawn/<id>/`, using the same file
names (`prompt.md`, `when.md`, and so on). Spawn validation rejects
an agent spec whose `prompt.md` is missing, or a spec with an agent
judge whose slot file is missing. Rejections go to
`input/spawn-rejections.md` as today. A leftover `instructions` key
in a spec is rejected with the same class of message as parse.

The engine stamps `promptDir` on the accepted task in `graph.json`,
next to `spawnDepth` and `spawnedBy`. The value is relative to the
run root, for example
`tasks/<parent>/attempt-<n>/out/spawn/<id>`. Resume and later
launches resolve the prompt from that directory, not from the
workflow folder. Authored tasks have no `promptDir`; they use
`tasks/<taskId>/` under the workflow folder.

Promoting a spawned task into `workflow.yaml` copies that folder to
`workflows/<workflowId>/tasks/<id>/` and strips `promptDir` with the
other spawn meta.

## Missing prompt and pre-run check

If an authored agent task is launched and `prompt.md` is missing,
the attempt fails immediately with reason `missing_prompt`. Retry
applies as for any failed attempt. Spawned tasks never reach launch
without a prompt; they are rejected at spawn validation.

A pre-run check (DES-019 list of pure functions) warns when an
authored agent task in the starting graph has no `prompt.md`, or
when an agent judge slot has no file. Warnings never block. The
reason at launch stays `missing_prompt`.

## Impact

| Area | What changes |
| ---- | ------------ |
| `packages/shared` | Drop `instructions` from agent, command and judge schemas; reject the leftover key; one-judge-per-slot refine; `taskPromptPath` / `judgePromptPath`; optional `promptDir` on tasks; `renames` on `putWorkflowBodySchema`. |
| `workflow-yaml-kind.ts` | Kind switch to agent no longer sets `instructions`. |
| `workflow-yaml-edit.ts` | `renameTask` stays; the server performs the folder moves. |
| `packages/engine` | `instructionsAbsPath` in `runner.ts` uses the helpers and `promptDir`; `judge.ts` and `conditions.ts` use slot paths; spawn validation checks the files and stamps `promptDir`; preflight adds the warn-only missing-prompt check; `agent-prompt.ts` signatures stay. |
| `apps/server` | Workflow PUT applies `renames` as above; promote copies the folder; files API already allows `tasks/...`. |
| `apps/web` | `AgentTaskFields.tsx`, `Inspector.tsx`, rename `InstructionsEditorDialog.tsx` to `PromptEditorDialog`; the editor sends `renames` with save. |
| Tests | About 30 fixtures still use `instructions:`; plus e2e graph-editor tests. |

The real workflow `implement-ticket` is updated by hand, not by the
app.
