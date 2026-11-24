---
id: BL-134
title: Node executor contract; trigger, approval, notify
type: backlog
status: done
summary: NodeKind.execute(ctx) returns AsyncIterable<StepEvent>; trigger, approval and notify are ported to it.
tags: [core, nodes, registry]
related: [DES-041, DES-035]
updated: 2026-11-24
priority: P1
depends: [BL-132]
---

# Node executor contract; trigger, approval, notify

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/nodes.

One executor shape for every kind, with `StepContext` capabilities instead of raw ports.

## Done when

- [x] `NodeKind` and `StepContext` (`inputs`, `runDir`, `signal`, `inbox.ask`, `outputs.write`) defined in core.
- [x] Trigger, Approval and Output notify run on the actor with today's behaviour.
- [x] Tests per kind on fakes.
