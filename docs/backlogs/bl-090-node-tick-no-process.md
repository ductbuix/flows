---
id: BL-090
title: Node tick with trigger, prompt and folder output
type: backlog
status: done
summary: Engine registry and node tick that runs no-process kinds end to end in a test home; not reachable from the app yet.
tags: [engine, nodes, registry, resume]
related: [DES-034, DES-035]
updated: 2026-11-22
priority: P0
depends: [BL-075]
---

# Node tick with trigger, prompt and folder output

Design: [DES-034](../designs/des-034-node-engine.md) (Kinds at run time, Crash recovery), [DES-035](../designs/des-035-node-registry.md) (Engine). Layer: engine only.

## Done when

- [x] `packages/engine/src/nodes/` has `defineExecutor` and executors for trigger, prompt and output (`folder`).
- [x] `startNodeRun` and `tickNodes` append `run_started` with the frozen graph, then `step_started` before each action, then settle; a run ends `run_succeeded` or `run_failed`.
- [x] Prompt and trigger outputs land as `text.md` in the step folder; folder output copies inputs to the run's `output/`.
- [x] Registry test: every shared kind built so far has an executor, and no executor names an unknown kind.
- [x] Test: `packages/engine/src/nodes/tick.test.ts` runs Trigger, Prompt, Output in a temporary `FLOWAPP_HOME`; the resume harness crashes after `step_started` for each kind and the rerun gives the same files.
