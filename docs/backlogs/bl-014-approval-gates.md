---
id: BL-014
title: Approval gates and cancel in the engine
type: backlog
status: todo
summary: "Engine support for approval: true gates, the cancelled state, and the run deleted marker event."
tags: [engine, approval, lifecycle, events]
related: [DES-003]
updated: 2026-11-21
priority: P1
depends: [BL-005]
---

# Approval gates and cancel in the engine

Spec: [DES-003](../designs/des-003-engine.md). The UI side is BL-012.

## Done when

- [ ] `approval: true` puts a ready task in `awaiting_approval` before its
      first launch; approve starts it, reject ends it `failed` with reason
      `rejected`.
- [ ] A waiting task holds no concurrency slot and is still waiting after
      a restart.
- [ ] Cancel moves unfinished tasks and the run to `cancelled` and ends
      running process groups.
- [ ] Deleting a run appends the marker event before removing files; the
      fold hides deleted runs; resume finishes an interrupted removal.
- [ ] Unit tests cover each transition and replay.
