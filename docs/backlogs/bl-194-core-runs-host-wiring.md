---
id: BL-194
title: "Wire core run actor and scheduler into the host"
type: backlog
status: todo
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

## Done when

- [ ] A command node run executes on the core actor in the daemon.
- [ ] Run events and fold match the old engine for the same workflow.
- [ ] `pnpm test` and `pnpm test:e2e` pass.
