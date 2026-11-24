---
id: BL-132
title: "RunActor: one mailbox per live run"
type: backlog
status: done
summary: A RunActor processes one input at a time (decide, append, run effects) and re-issues missing effects on recovery.
tags: [core, runs, engine]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-131, BL-125, BL-128]
---

# RunActor: one mailbox per live run

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/runs.

Give each run a single writer, replacing the shared tick loop, as DES-041 Run engine describes.

## Done when

- [x] Inputs `start`, `effect_result`, `answer`, `cancel`, `agent_event` are queued and handled in order.
- [x] Recovery replays events and re-issues effects without a result event, idempotent by step attempt id.
- [x] Service tests on fakes: crash between append and effect does not duplicate a step.
