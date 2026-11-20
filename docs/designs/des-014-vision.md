---
id: DES-014
title: Vision, goals and principles
type: direction
status: active
summary: What Flows is and is for, goals, non-goals, success criteria and the principles that guide every design choice.
tags: [direction, vision, goals, principles]
related: [DES-001, DES-007, DES-015, DES-016, DES-017]
updated: 2026-11-21
---

# Vision, goals and principles

The domain model and stack are in [DES-001](des-001-overview.md); this
doc is the why and the boundaries.

## Vision

Flows lets one developer build and run workflows of tasks on their own
Mac. A task is any process: a shell command, a node or python script, or
an AI agent CLI (Claude Code or Cursor CLI). A workflow chains tasks with
parallel branches, conditions and loops, and agents can grow the graph
while it runs. Everything stays on the machine.

## Who it is for

A single developer, on macOS, running the app locally on 127.0.0.1. No
accounts, no sharing, no server to host.

## Goals

1. Describe a workflow once, as `workflow.yaml` or in the visual editor,
   with both kept in sync (DES-002, DES-010).
2. Run it reliably: parallel tasks under limits, conditions, retry and
   repeat, and resume after a restart without rerunning finished work
   (DES-003, DES-004).
3. Let agents do open-ended work: stateless agent tasks with memories and
   instructions that can spawn more tasks (DES-005).
4. See and steer every run live: states, attempts, logs, summaries,
   approve or reject, cancel, retry (DES-009, DES-011).
5. Keep tasks from damaging the machine: writes limited to the workflow
   dir where the sandbox allows (DES-006).

## Non-goals (for now)

| Out of scope                     | Why, and where it is recorded                     |
| -------------------------------- | ------------------------------------------------- |
| Linux and Windows                | macOS only on day one; DES-006, DES-007 ledger    |
| Multi-user, accounts, sharing    | local app for one developer, bound to 127.0.0.1   |
| Cloud or remote execution        | one machine, SQLite log; DES-007 ledger           |
| A `matrix` key                   | fan-out is done by spawn; DES-005, DES-007 ledger |
| Agent limits (turns, time, cost) | not defined yet; DES-002, DES-007 ledger          |
| Saved node positions             | layout is automatic; DES-010, DES-007 ledger      |

Each non-goal has a revisit trigger in [DES-007](des-007-tradeoffs.md).

## Success criteria

Derived from the backlog "Done when" sections; the roadmap is in
[DES-017](des-017-roadmap.md).

- A workflow with parallel, conditional and looping tasks runs to the end
  and every task leaves a `SUMMARY.md` and its outputs on disk.
- Killing the app mid-run and starting it again finishes the run with no
  task run twice.
- An agent task can fan out by spawning tasks, within `maxTasks` and
  `maxSpawnDepth`.
- A gated task waits for approval, across restarts.
- The run view shows live state and the editor round-trips YAML without
  losing comments.

## Principles

- **Local first.** One machine, one user, files and SQLite on disk, bound
  to 127.0.0.1.
- **Dynamic workflows.** `workflow.yaml` is the starting graph; each run's
  graph can grow (DES-001, DES-005).
- **Files are the context.** A dir is the compacted context of its object;
  tasks read upstream outputs by path and write their own summary
  (DES-002).
- **The event log is the truth.** Append, then act; state is a fold over
  events; resume is a replay (DES-003).
- **KISS and YAGNI.** Build the smallest thing that meets the goal, record
  what was left out in DES-007 with a revisit trigger, and decide open
  product questions with the user rather than guessing.
