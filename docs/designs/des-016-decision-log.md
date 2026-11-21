---
id: DES-016
title: Decision log
type: direction
status: active
summary: One line per key decision with date, reason and the doc that holds it. Index only; the linked docs hold the detail.
tags: [direction, decisions, adr]
related:
  [
    DES-001,
    DES-003,
    DES-005,
    DES-006,
    DES-007,
    DES-012,
    DES-013,
    DES-014,
    DES-018,
    DES-019,
    DES-020,
    DOC-001,
  ]
updated: 2026-11-21
---

# Decision log

Index of decisions already made. Do not re-argue them here: the linked
doc holds the detail, and [DES-007](des-007-tradeoffs.md) holds the risk,
guard and revisit trigger. Add a row when a decision lands; when one is
reversed, keep the row and add a new one that says so.

## Platform and stack

| Date       | Decision                                    | Reason                                         | Holds it     |
| ---------- | ------------------------------------------- | ---------------------------------------------- | ------------ |
| 2026-11-20 | Local web app, bound to 127.0.0.1           | one developer, one machine, no hosting         | DES-001      |
| 2026-11-20 | Node and TypeScript backend                 | one language across web, server and engine     | DES-001      |
| 2026-11-20 | Hono on `@hono/node-server` as the API      | small, built-in websockets, typed `hc` client  | DES-001      |
| 2026-11-20 | Turborepo pnpm monorepo, shadcn Vite preset | shared types and UI across apps, one toolchain | DES-001, 008 |
| 2026-11-20 | Server runs with tsx, no build step         | fastest loop while local only                  | DES-007      |
| 2026-11-21 | macOS only on day one                       | one sandbox path to build (`sandbox-exec`)     | DES-006, 007 |

## Engine

| Date       | Decision                                          | Reason                                                         | Holds it     |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------- | ------------ |
| 2026-11-20 | SQLite append-only event log, state is a fold     | one source of truth, resume by replay                          | DES-003      |
| 2026-11-21 | `node:sqlite` for `app.db` (no native addon)      | built into Node 22+; sync API fits append-then-act             | DES-003, 015 |
| 2026-11-20 | Append, then act                                  | a crash can never act without a record, or act twice           | DES-003      |
| 2026-11-20 | Tasks read upstream dirs by path                  | files are the context; no copying                              | DES-002, 007 |
| 2026-11-20 | Retry and repeat are separate policies            | failure and "not done yet" are different loops                 | DES-004      |
| 2026-11-21 | Shared condition shape for when, until, branches  | one evaluator; cheap kinds before agent (BL-011)               | DES-004      |
| 2026-11-21 | Agent judge via CLI exit 0 / non-zero             | same adapters as tasks; not a graph task; cached / run         | DES-004      |
| 2026-11-20 | Nested concurrency limits plus an `agents` limit  | control at global, workflow, run and group level               | DES-003      |
| 2026-11-21 | Dynamic workflows: fan-out by spawn, no `matrix`  | agents decide the split; one mechanism instead of two          | DES-001, 005 |
| 2026-11-21 | Headless Claude/Cursor adapters + `tasks_spawned` | file spawn under attempt `out/spawn/`; reject to input         | DES-005      |
| 2026-11-21 | Per-task instructions file, no agent limits yet   | user writes the instructions; limits wait for real need        | DES-002, 007 |
| 2026-11-21 | Approval gates with `approval: true`              | a human can hold a task; events make it survive restarts       | DES-003      |
| 2026-11-21 | `cancelled` terminal state for tasks and runs     | cancel is not failure                                          | DES-003      |
| 2026-11-21 | Run delete keeps events with a deleted marker     | the log stays append-only; files are removed                   | DES-003      |
| 2026-11-21 | Manual retry via `task_retry_requested` event     | reopen finished runs; UI retry is not `retry.max`              | DES-003, 011 |
| 2026-11-21 | Per-attempt timeout, default 900s                 | a hung CLI must not sit in `running` until cancel              | DES-004, 019 |
| 2026-11-21 | App-owned trust for all of `FLOWAPP_HOME`         | CLIs stay headless; the human decision stays in the app        | DES-019      |
| 2026-11-21 | Cursor agents may write under `~/.cursor`         | CLI needs projects/chats dirs; seatbelt still limits elsewhere | DES-006, 019 |
| 2026-11-21 | Always-trust is a settings row, bound to realpath | not run state; the events table requires `run_id`              | DES-003, 019 |
| 2026-11-21 | Pre-run checks warn only, including paths outside | the user can still run after a double check                    | DES-019, 007 |
| 2026-11-21 | CLI adapter, check list, and `decideTrust`        | add a CLI or check without new layers; no plugin loader        | DES-019      |
| 2026-11-21 | Fixed prompt paths; no `instructions` key         | yaml and the prompt file cannot drift                          | DES-020      |
| 2026-11-21 | At most one agent judge per slot                  | one slot, one file; revisit if a workflow needs two            | DES-020, 007 |
| 2026-11-21 | Leftover `instructions` keys are a parse error    | no auto-migration; the error names the target path             | DES-020      |

## UI

| Date       | Decision                                          | Reason                                                  | Holds it     |
| ---------- | ------------------------------------------------- | ------------------------------------------------------- | ------------ |
| 2026-11-20 | Visual editor and `workflow.yaml` kept in sync    | the file is the source of truth, the graph a view of it | DES-002, 010 |
| 2026-11-21 | react-markdown with remark-gfm for summaries      | about 49 KB, never renders raw HTML                     | DES-012      |
| 2026-11-21 | CodeMirror 6 for the YAML pane                    | about 141 KB with diagnostics; Monaco is about 1.1 MB   | DES-012      |
| 2026-11-21 | React Flow with dagre, automatic layout           | about 16 KB; no positions to sync                       | DES-012, 010 |
| 2026-11-21 | Run view has full controls and list plus graph    | answered in the run view review                         | DES-009, 011 |
| 2026-11-21 | Server folds runs; web applies `run_snapshot`     | web must not import engine (DES-015); same fold result  | DES-009, 015 |
| 2026-11-21 | YAML writes keep comments and key order           | hand edits must survive graph edits                     | DES-013      |
| 2026-11-21 | Kind switch writes a valid shape for the new kind | Inspector only patched kind, so agent tasks failed save | DES-018      |
| 2026-11-21 | Plain textarea for memory and instructions files  | quicker edit in the UI; YAML pane keeps CodeMirror      | DES-018      |
| 2026-11-21 | Add memory .md files with a native file picker    | on a name collision, ask to overwrite or rename         | DES-018      |
| 2026-11-21 | Inspector shows a fixed prompt path and Edit prompt | the user no longer edits the path                       | DES-020      |
| 2026-11-21 | Task rename moves the prompt folder in the same PUT | yaml and files stay in sync                             | DES-020, 013 |

## Docs and tooling

| Date       | Decision                                        | Reason                                                   | Holds it         |
| ---------- | ----------------------------------------------- | -------------------------------------------------------- | ---------------- |
| 2026-11-20 | One frontmatter schema, generated indexes       | agents find docs in few reads; checked by `docs:check`   | DOC-001          |
| 2026-11-20 | Index files unpadded, skip prettier             | 33 to 60 percent smaller                                 | DES-007          |
| 2026-11-21 | `direction` docs listed first in the root index | vision, architecture, decisions and roadmap in one place | DOC-001          |
| 2026-11-21 | Keep code clean, refactor proactively, bounded  | cleaner code without churn; refactors in own commits     | `clean-code.mdc` |
