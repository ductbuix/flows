---
id: DES-020
title: Fixed prompt files and generated task ids
type: design
status: active
summary: Agent prompts live at tasks/<taskId>/; task ids are engine-generated; a name field is the display label.
tags: [agents, yaml, editor, files, spawn]
related:
  [
    DES-002,
    DES-004,
    DES-005,
    DES-010,
    DES-013,
    DES-018,
    DES-019,
    BL-019,
    BL-020,
    DES-022,
  ]
updated: 2026-11-21
---

# Fixed prompt files and generated task ids

The `instructions` key is a free path today, and task ids are
free-text. This design removes the key, derives prompt paths from
the task id, and has the engine generate ids. `TASK_INSTRUCTIONS`
keeps its name and points at the derived file.

## Task ids and names

New task ids are generated when a task is created: adding a node in
the editor, kind-switch templates that insert a new task, and spawn
acceptance. The format is `task-` plus the first eight hex characters
of a UUID v4, for example `task-3f9a1c2e`. If that id already exists
in the workflow or the run graph, generate again.

Ids are immutable. The Inspector has no id edit field. A shared
helper `newTaskId()` in `packages/shared` is used by the editor and
the engine, so they cannot drift.

Every task may have an optional `name`, a display label the user can
edit. The graph, the Inspector, and the run view show `name`, and
fall back to `id` when `name` is missing or blank. Names need not be
unique.

Legacy ids such as `start` or `plan` stay valid. `parseWorkflowYaml`
accepts any single path segment (no `/`, backslash, or `..`) and does
not require the `task-[0-9a-f]{8}` pattern. Only newly generated ids
follow the pattern. Existing workflows do not have to be rewritten.
Ledger: [DES-007](des-007-tradeoffs.md).

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

- `newTaskId()` → a fresh `task-<8 hex>` id
- `taskPromptPath(taskId)` → `tasks/<taskId>/prompt.md`
- `judgePromptPath(taskId, slot)` → the slot file above
- `upstreamEnvName(taskId)` → `UPSTREAM_` plus the id with every
  `-` replaced by `_` (see below)

`parseWorkflowYaml` rejects an unsafe id with a clear error. No
other new abstraction.

## Workflow yaml

An agent task no longer has `instructions`. The engine derives the
path from the id. A command task has no prompt file and no
`instructions` field. `TASK_INSTRUCTIONS` is set only for agent
tasks.

```yaml
tasks:
  - id: task-a1b2c3d4
    name: Plan
    kind: agent
    cli: claude
    spawn: true
  - id: task-e5f60718
    name: Check
    kind: command
    run: python check.py
    needs: [task-a1b2c3d4]
    repeat:
      until:
        any:
          - expr: "json('out/score.json').score >= 0.8"
          - agent: { cli: claude } # reads tasks/task-e5f60718/until.md
```

Any leftover `instructions` key, on a task or a judge, is a parse
error. The message tells the user to move the file to the derived
path (when that path can be computed) and to delete the key. There
is no auto-migration. The one known real workflow is
`~/.flowapp/workflows/implement-ticket` (`instructions: tasks/start.md`
on task `start`). That is fixed by hand: move the file to
`tasks/start/prompt.md` and drop the key. Its ids (`start`,
`analyze-ticket`) stay as they are.

## Upstream env names

Today the runner sets `UPSTREAM_<id>` with the raw id
(`runner.ts`). A hyphen is not valid in a shell variable name, so
`$UPSTREAM_task-3f9a1c2e` would not work (the shell would parse a
`-` as part of `${var-default}`). The env name is therefore
`UPSTREAM_` plus the id with every `-` replaced by `_`. The id
`task-3f9a1c2e` is `UPSTREAM_task_3f9a1c2e`. A legacy id
`analyze-ticket` is `UPSTREAM_analyze_ticket`.

Two tasks in the same graph must not map to the same env name. If
they would, `parseWorkflowYaml` reports a clear error.

## Inspector

The path input and the id edit input go away. The id is shown as
read-only muted text (copyable). A **Name** field sits above it.
The prompt label is **Prompt**. The button is **Edit prompt**,
always enabled. Muted text under it reads "Stored at
`tasks/<id>/prompt.md` in this workflow." If the file is missing,
it also says "Not created yet." **Edit prompt** opens the existing
textarea dialog (`FileEditorDialog`) and creates the file on first
save, through the files API from DES-018.

Kind switch to `agent` no longer writes an `instructions` field
(DES-018 still requires a valid shape: `cli: claude`, drop `run`).
The task keeps its id and `name`.

The first UI cut is the agent task prompt only. The Inspector does
not yet edit `when` or `until`. Judge files can be written through
the files API. Revisit when the Inspector grows condition editors.

Test ids: `field-task-id`, `field-task-name`, `field-prompt-path`,
`edit-prompt`, `prompt-editor`, `prompt-save`.

## Delete

There is no task-id rename in the app, so the workflow PUT does not
take a `renames` list. Removing a task on Save moves `tasks/<id>/`
to `tasks/.trash/` and collects leftover `need-<id>.md` files from
dependents ([DES-022](des-022-remove-task.md)). The earlier choice
to leave orphan folders in place is reversed.

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

Spawn specs no longer carry `id`. Each spec is identified by its
file stem: `out/spawn/<stem>.yaml`, with prompt and judge files
under `out/spawn/<stem>/`. A leftover `id` key in a spec is
rejected, with a message that the stem is the identity.

A stem must be a single path segment, must not match
`task-[0-9a-f]{8}`, must be unique in the batch, and must not equal
any task id already in the graph. That makes a `needs` entry
unambiguous: it is either a sibling stem or an existing task id,
never both. The engine assigns each accepted spec a new id, rewrites
`needs` from stems to real ids, and stamps `promptDir` (run-root
relative, for example
`tasks/<parent>/attempt-<n>/out/spawn/<stem>`), plus `spawnDepth`
and `spawnedBy`. Resume and later launches resolve the prompt from
that directory. Authored tasks have no `promptDir`; they use
`tasks/<taskId>/` under the workflow folder.

Spawn validation still checks schema, unique generated ids, existing
needs, no cycles, `maxTasks`, `maxSpawnDepth`, and that required
prompt and judge files exist. Rejections go to
`input/spawn-rejections.md` as today. A leftover `instructions` key
is rejected with the same class of message as parse. An optional
`name` in the spec is kept.

Promoting a spawned task into `workflow.yaml` copies that folder to
`workflows/<workflowId>/tasks/<id>/` and strips `promptDir` with the
other spawn meta. The generated id is kept.

## Missing prompt and pre-run check

If an authored agent task is launched and `prompt.md` is missing,
the attempt fails immediately with reason `missing_prompt`. Retry
applies as for any failed attempt. Spawned tasks never reach launch
without a prompt; they are rejected at spawn validation.

A pre-run check (DES-019 list of pure functions) warns when an
authored agent task in the starting graph has no `prompt.md`, or
when an agent judge slot has no file. Warnings never block. The
reason at launch stays `missing_prompt`.

## Hand-edited yaml

The YAML pane can still change a task's `id`, as long as the new
value is a safe single path segment and is unique in the file.
The app does not move `tasks/<old>/` or rewrite `needs` or
`need-*` files. The user must move files and update references by
hand. That is an accepted risk (DES-007).

## Impact

| Area                    | What changes                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared`       | Drop `instructions`; reject the leftover key; one-judge-per-slot refine; `newTaskId`, `taskPromptPath`, `judgePromptPath`, `upstreamEnvName`; optional `name` and `promptDir` on tasks; no `renames` on the PUT body. |
| `workflow-yaml-kind.ts` | Kind switch to agent no longer sets `instructions`. The id is unchanged.                                                                                                                                              |
| `packages/engine`       | Prompt resolution via the helpers and `promptDir`; spawn assigns ids from stems and rewrites `needs`; `UPSTREAM_*` uses `upstreamEnvName`; preflight missing-prompt check.                                            |
| `apps/server`           | Promote copies the folder; files API already allows `tasks/...`.                                                                                                                                                      |
| `apps/web`              | Inspector: read-only id, editable Name, Edit prompt; add-node uses `newTaskId()`; rename `InstructionsEditorDialog.tsx` to `PromptEditorDialog`. Graph and run view show `name`.                                      |
| Tests                   | About 30 fixtures still use `instructions:`; spawn fixtures that set `id:`; e2e graph-editor tests.                                                                                                                   |

The real workflow `implement-ticket` is updated by hand for the
prompt path only, not by the app. Its legacy ids stay.
