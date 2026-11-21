---
id: BL-017
title: Per-attempt timeout and failure reasons
type: backlog
status: done
summary: Kill a timed-out attempt's process group, fail it with a clear reason, and map known CLI stderr patterns.
tags: [engine, timeout, agents]
related: [DES-019, DES-004, DES-015]
updated: 2026-11-21
priority: P0
depends: []
---

# Per-attempt timeout and failure reasons

Design: [DES-019](../designs/des-019-agent-trust-and-timeouts.md).
Timeout and retry: [DES-004](../designs/des-004-conditions-loops.md).

## Done when

- [x] Every attempt, including agent judges, has a timeout. Default
      is 900 seconds, overridable with `timeout` on the workflow or
      the task (seconds).
- [x] When the timeout fires, the engine ends the process group and
      fails the attempt with reason `timeout`. Retry and repeat apply
      as for any failed attempt.
- [x] Resume enforces the remaining time from `attempt_started` and
      the resolved timeout.
- [x] Known Cursor stderr patterns from DES-019 map to a readable
      failure reason, which wins over a generic timeout or exit.
- [x] Unit tests cover the timeout, process-group kill, reason
      mapping, and the task / workflow / default resolution order.
- [x] Playwright: a task that outlives a short timeout fails with a
      visible `timeout` reason; video and screenshots.
