---
id: BL-091
title: Agent and command executors with data passing
type: backlog
status: done
summary: Agent and command executors on the existing launch path, with input/text.md, input files, NODE_* env, retry, limits and resume.
tags: [engine, nodes, agents, resume]
related: [DES-034, DES-005, DES-019]
updated: 2026-11-22
priority: P0
depends: [BL-090]
---

# Agent and command executors with data passing

Design: [DES-034](../designs/des-034-node-engine.md) (Data passing, Retry, Crash recovery). Layer: engine only.

## Done when

- [x] Agent and command executors return a launch spec that `launchTaskAttempt` (`packages/engine/src/launch.ts`) starts in the sandbox; no kind branch is added to `runner.ts`.
- [x] Each attempt gets `input/text.md`, `input/files/<fromNodeId>/` links, `UPSTREAM_*` and the DES-034 `NODE_*` names.
- [x] `retry: { max }` and `timeout` work per pass; agent steps count against `agents`; no-process steps hold no slot.
- [x] Test: `packages/engine/src/nodes/process-kinds.test.ts` with a stub `claude` on PATH (as `agents-run.test.ts` does): env names, joined input, a retry, the agents limit, and resume re-attach and interrupt.
