---
id: BL-194
title: "Wire core run actor and scheduler into the host"
type: backlog
status: done
summary: The daemon composes core RunActor and Scheduler behind ports; createEngine stops owning run state.
tags: [core, runs, host]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: [BL-193]
---

# Wire core run actor and scheduler into the host

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/core, apps/server.

Today `createScheduler` has no caller outside tests and runs go through `packages/engine` (`nodes/drive.ts`). Compose the core actor and scheduler in `createFcpHost` with adapters-node ports.

## Plan

Phase 38 (BL-194..197) moves runs off `engine/nodes/drive.ts` onto `core/runs`.

1. **BL-194 (this):** In `createFcpHost`, compose `createScheduler` + per-run `RunActor` over the engine `EventLog` as `EventStore` and adapters-node `DocumentStore` / `ProcessRunner`. Seam in `startRunForFcp`: graphs whose nodes are only `trigger`+`command` start on core; other kinds keep the engine path. Shared event log so `run/get`/`run/list`/UpdateBus stay unchanged. If the scheduler would queue, fall back to engine (queue activation is BL-196).
2. **BL-195:** Port remaining executors into `core/nodes`; widen the eligible-kind set one kind at a time via the same seam.
3. **BL-196:** Partial runs, loops, retry, cancel/resume, and scheduler queue activation (`run_activated`) on core; resume after daemon restart from the event log.
4. **BL-197:** Point daemon/CLI/desktop at core only; delete `runNodes` / `resumeNodes` / drive path.

## Done when

- [x] A command node run executes on the core actor in the daemon.
- [x] Run events and fold match the old engine for the same workflow.
- [x] `pnpm test` and `pnpm test:e2e` pass.
