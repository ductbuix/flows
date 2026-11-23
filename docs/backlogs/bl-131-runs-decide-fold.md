---
id: BL-131
title: Pure decide and fold for runs
type: backlog
status: todo
summary: Run rules move into pure decide(state, input) -> { events, effects } and fold(state, event) in core, ported from nodes/tick.
tags: [core, runs, engine]
related: [DES-041, DES-034, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-113]
---

# Pure decide and fold for runs

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/runs.

Separate rules from I/O (functional core). Today's tick logic is the source; behaviour stays the same.

## Done when

- [ ] `decide` and `fold` have no I/O and no clock reads (time comes in the input).
- [ ] Effects are a discriminated union: `launch_step`, `post_inbox`, `write_output`, `notify`.
- [ ] Table tests port today's tick tests (branches, loops with limit, retry, partial runs).
