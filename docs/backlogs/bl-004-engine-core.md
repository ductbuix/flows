---
id: BL-004
title: Engine core
type: backlog
status: done
summary: packages/engine with workflow schema, SQLite event log, scheduler, command tasks, needs and parallelism.
tags: [engine, events, scheduler]
related: [DES-002, DES-003]
updated: 2026-11-21
priority: P0
depends: [BL-001]
---

# Engine core

First step of the build order. Read [DES-003](../designs/des-003-engine.md)
and [DES-002](../designs/des-002-workflow-files.md) first.

## Scope

- `packages/engine`: zod schema for `workflow.yaml` (in `packages/shared`
  if the web needs it).
- SQLite append-only event log; state is a fold over events.
- Scheduler tick: ready tasks from `needs`, run `kind: command` tasks as
  detached processes, parallel where the graph allows.
- Run and attempt dirs and logs as in DES-002.

## Out of scope

Resume (BL-005), conditions and loops (BL-006), agents (BL-007).

## Done when

- [x] A diamond graph (a, then b and c in parallel, then d) runs to
      success.
- [x] Replaying the event log gives the same state as the live run.
- [x] Unit tests cover the fold and the scheduler; `pnpm test` passes.
