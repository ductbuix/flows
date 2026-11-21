---
id: DES-007
title: Trade-offs and open questions
type: design
status: active
summary: Ledger of known risks (decision, risk, guard, revisit trigger) for the design and tooling, plus open questions.
tags: [tradeoffs, decisions, questions, tooling]
related:
  [
    DES-001,
    DES-003,
    DES-006,
    DES-009,
    DES-010,
    DES-011,
    DES-012,
    DES-019,
    DES-020,
    DES-021,
    DES-022,
    DOC-001,
  ]
updated: 2026-11-21
---

# Trade-offs and open questions

Each entry is a deliberate choice. The guard is what limits the damage
today; the revisit trigger is the concrete event that reopens it. Add an
entry whenever you ship something knowingly imperfect, and delete it when
the trigger fires and the choice changes.

## Engine design

| Decision                            | Risk                               | Guard                                                                          | Revisit when                                                                                    |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Tasks read upstream dirs by path    | can read beyond declared needs     | writes limited to the workflow dir (DES-006)                                   | runs must move to another machine                                                               |
| SQLite log, no queue                | single-process engine              | append-then-act and replay on resume (DES-003)                                 | a second machine runs tasks                                                                     |
| macOS only on day one               | no Linux or Windows users          | `sandbox-exec` is the one sandbox path to build                                | first user asks for Linux or Windows                                                            |
| Sandbox best effort                 | a task runs unsandboxed            | warning badge on unsandboxed runs (DES-006)                                    | a run needs the sandbox to be safe                                                              |
| No `matrix`; fan-out by spawn       | a fixed list costs an agent run    | write copies by hand, or spawn within `maxTasks` and `maxSpawnDepth` (DES-005) | users keep hand-writing identical tasks, or spawn fan-out is too slow or costly for fixed lists |
| No agent limits yet                 | a runaway or expensive agent run   | retry and repeat max, `maxTasks`, `maxSpawnDepth`, `agents`, cancel            | a runaway or expensive agent run                                                                |
| Pre-run checks warn, never block    | a run proceeds despite a warning   | dialog lists the warning and asks the user to double check (DES-019)           | a path-outside-home warning is ignored and causes harm                                          |
| At most one agent judge per slot    | a slot cannot hold two judges      | schema error with a clear message; one file per slot (DES-020)                 | a real workflow needs two agent judges in one `when`, `until`, or need                          |
| Deleting a task leaves its folder   | orphan prompt files can pile up    | reversed: Save now moves the folder to `tasks/.trash/` (DES-022)               | (superseded 2026-11-21)                                                                         |
| No auto-purge of `tasks/.trash/`    | trash can grow on disk             | no restore UI; the user can delete folders by hand (DES-022)                   | trash becomes large or users want a restore action                                              |
| No prompt snapshot at run start     | retry of a finished run can miss a trashed prompt | block Save while a live or queued run still needs the task (DES-022) | retry after delete is common, or prompts are copied into the run at start                    |
| Editor undo stack ignores YAML pane keystrokes | mixed undo with CodeMirror history | YAML pane keeps CodeMirror undo; stack is for graph and inspector edits (DES-022) | users expect one undo stack across the yaml pane and the graph                               |
| No auto-migration of `instructions` | old yaml fails to parse            | clear error names the target path; one known workflow is fixed by hand         | many existing workflows still use the old key                                                   |
| Legacy task ids stay valid          | old and new id shapes coexist      | new ids are generated; existing single-segment ids still parse (DES-020)       | legacy ids become confusing next to generated ones                                              |
| Hand-editing a task id in YAML      | prompt folder and `needs` can drift | allowed; the app does not move files; the doc warns the user must do it        | a hand edit leaves a broken graph or a missing prompt                                           |
| Input types are text, markdown, file | a later source may need a folder or JSON | add a type when a source needs it (DES-021)                                   | a Manual form or a later source needs another type                                              |
| Omitted `maxConcurrentRuns` means 1 | two starts on one workflow queue   | set the limit in yaml; tests that start two runs must set it (DES-021)         | users often want many runs at once by default                                                   |
| No global run cap in `config.yaml`  | one workflow can set a high cap    | per-workflow limit, default 1 (DES-021)                                        | a batch starts too many runs across workflows                                                   |
| Source adapter has no `listItems` yet | a second source will have to add it | Manual only needs `materialize` (DES-021)                                    | a folder, list, or connector source is added                                                    |
| Item key ignores copied `WF_INPUT` defaults | same form with new defaults looks like a repeat | defaults are shared; form values are the item (DES-021)               | users expect a defaults change to count as a new item                                           |
| Run start copies workflow `input/`  | a large shared folder makes start heavy | first cut copies so the snapshot is complete (DES-021)                     | start becomes slow or the copy is large                                                         |
| Connectors are not run sources yet  | ticket reuse still uses the Manual form | a later adapter can add a connector with no engine change (DES-021)        | a connector is needed as a source                                                               |
| Cursor agents may write `~/.cursor` | CLI can write outside the workflow | pre-written trust markers; seatbelt still denies other paths (DES-006, 019)    | Cursor stops needing chats/projects writes, or a tighter path list is enough                    |
| Agent judge conditions              | slow, not deterministic            | cheap kinds evaluate first; loop max counts (DES-004)                          | judges disagree on identical output                                                             |

## Tooling and docs

### Docs indexes are unpadded and skip prettier

- Risk: raw tables are harder for humans to read; a hand edit could break
  them.
- Guard: only the generator writes them. `docs:check` fails on stale
  indexes and on tables without a header, separator row or equal cell
  counts. The Cursor hook regenerates them after doc edits.
- Revisit when: a renderer shows a broken index table, or people read the
  raw indexes more than agents do.

### Server runs from source with `tsx`, no build step

- Risk: slower start, `tsx` is a runtime dependency, no bundled artifact.
- Guard: `pnpm typecheck` covers the server; it binds to `127.0.0.1` only.
- Revisit when: the app is packaged or distributed, or cold start passes
  2 seconds.

### Playwright reuses a running dev server outside CI

- Risk: e2e may test a stale or hand-started server.
- Guard: `CI=1` forces fresh servers; the e2e test only reads health today.
- Revisit when: an e2e result differs between a fresh run and a reused
  server.

### Playwright records video and screenshots for every test

- Risk: slower runs and more disk in `apps/e2e/test-results`.
- Guard: `PW_VIDEO` and `PW_SCREENSHOT` lower it; results are git-ignored.
- Revisit when: the e2e suite takes over 2 minutes or results pass 500 MB.

### Cursor format hook fails open

- Risk: an error `eslint --fix` cannot fix slips past the hook.
- Guard: `pnpm lint` is part of "done" in `AGENTS.md` and the rules.
- Revisit when: a lint error reaches a commit on `develop`.

### One ESLint config per package

- Risk: six `eslint.config.js` files (two React, four Node copies) drift.
- Guard: each uses the same recommended sets; `pnpm lint` runs them all.
- Revisit when: one rule change has to be made in more than one file.

## UI

### Graph layout is automatic, positions are not saved

- Risk: users cannot arrange a large graph the way they think about it.
- Guard: dagre gives a stable layered layout; `workflow.yaml` stays the
  only file to sync.
- Revisit when: users ask to pin node positions, or a workflow's graph is
  hard to read with the automatic layout.

### react-markdown instead of Streamdown for `SUMMARY.md`

- Risk: two markdown stacks if agent output is later rendered as it
  streams.
- Guard: Streamdown is a drop-in replacement for react-markdown.
- Revisit when: the UI renders markdown that is still streaming.

### CodeMirror without schema completion

- Risk: no autocomplete of workflow keys while typing YAML.
- Guard: diagnostics from the `yaml` parser and the zod schema, inline.
- Revisit when: users ask for completion, or schema errors are common in
  hand-written YAML.

Index size, measured on 2026-11-20 with 20 docs (generated vs the same
file run through prettier): root 655 vs 1053 bytes, designs 1915 vs 2597,
backlogs 2466 vs 3299. Prettier adds 33 to 60 percent, all padding, and
the overhead grows with the longest summary in each table.

## Open questions

None open as of 2026-11-21.

Settled on 2026-11-21: approval gates (yes), macOS only on day one,
`cancelled` state for tasks and runs, and deleted runs kept in the log
with a marker event. See DES-003 and DES-006. Also settled: no `matrix`
key; workflows are dynamic and fan-out is done by spawn (DES-001,
DES-005). And: each agent task has a fixed prompt file (DES-020),
with no agent limits yet (DES-002).

The UI design docs have no open questions as of 2026-11-21.
