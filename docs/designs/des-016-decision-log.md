---
id: DES-016
title: Decision log
type: direction
status: active
summary: One line per key decision with date, reason and the doc that holds it. Index only; the linked docs hold the detail.
tags: [direction, decisions, adr]
related:
  [DES-001, DES-003, DES-005, DES-006, DES-007, DES-012, DES-014, DOC-001]
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

| Date       | Decision                                         | Reason                                                   | Holds it     |
| ---------- | ------------------------------------------------ | -------------------------------------------------------- | ------------ |
| 2026-11-20 | SQLite append-only event log, state is a fold    | one source of truth, resume by replay                    | DES-003      |
| 2026-11-21 | `node:sqlite` for `app.db` (no native addon)     | built into Node 22+; sync API fits append-then-act       | DES-003, 015 |
| 2026-11-20 | Append, then act                                 | a crash can never act without a record, or act twice     | DES-003      |
| 2026-11-20 | Tasks read upstream dirs by path                 | files are the context; no copying                        | DES-002, 007 |
| 2026-11-20 | Retry and repeat are separate policies           | failure and "not done yet" are different loops           | DES-004      |
| 2026-11-20 | Nested concurrency limits plus an `agents` limit | control at global, workflow, run and group level         | DES-003      |
| 2026-11-21 | Dynamic workflows: fan-out by spawn, no `matrix` | agents decide the split; one mechanism instead of two    | DES-001, 005 |
| 2026-11-21 | Per-task instructions file, no agent limits yet  | user writes the instructions; limits wait for real need  | DES-002, 007 |
| 2026-11-21 | Approval gates with `approval: true`             | a human can hold a task; events make it survive restarts | DES-003      |
| 2026-11-21 | `cancelled` terminal state for tasks and runs    | cancel is not failure                                    | DES-003      |
| 2026-11-21 | Run delete keeps events with a deleted marker    | the log stays append-only; files are removed             | DES-003      |

## UI

| Date       | Decision                                       | Reason                                                  | Holds it     |
| ---------- | ---------------------------------------------- | ------------------------------------------------------- | ------------ |
| 2026-11-20 | Visual editor and `workflow.yaml` kept in sync | the file is the source of truth, the graph a view of it | DES-002, 010 |
| 2026-11-21 | react-markdown with remark-gfm for summaries   | about 49 KB, never renders raw HTML                     | DES-012      |
| 2026-11-21 | CodeMirror 6 for the YAML pane                 | about 141 KB with diagnostics; Monaco is about 1.1 MB   | DES-012      |
| 2026-11-21 | React Flow with dagre, automatic layout        | about 16 KB; no positions to sync                       | DES-012, 010 |
| 2026-11-21 | Run view has full controls and list plus graph | answered in the run view review                         | DES-009, 011 |
| 2026-11-21 | YAML writes keep comments and key order        | hand edits must survive graph edits                     | DES-013      |

## Docs and tooling

| Date       | Decision                                        | Reason                                                   | Holds it         |
| ---------- | ----------------------------------------------- | -------------------------------------------------------- | ---------------- |
| 2026-11-20 | One frontmatter schema, generated indexes       | agents find docs in few reads; checked by `docs:check`   | DOC-001          |
| 2026-11-20 | Index files unpadded, skip prettier             | 33 to 60 percent smaller                                 | DES-007          |
| 2026-11-21 | `direction` docs listed first in the root index | vision, architecture, decisions and roadmap in one place | DOC-001          |
| 2026-11-21 | Keep code clean, refactor proactively, bounded  | cleaner code without churn; refactors in own commits     | `clean-code.mdc` |
