---
id: BL-195
title: "Move node executors to core"
type: backlog
status: todo
summary: Command, Agent, LLM, Judge, Approval, Output, Asset and Trigger executors run on core ports.
tags: [core, nodes, executors]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: [BL-194]
---

# Move node executors to core

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/core.

Port each executor from `packages/engine/src/nodes/` to `core/nodes` behind ports. Keep the existing tests and move them with the code.

## Done when

- [ ] Every kind in `packages/engine/src/nodes/registry.ts` has a core executor.
- [ ] Moved tests pass unchanged on fakes.
