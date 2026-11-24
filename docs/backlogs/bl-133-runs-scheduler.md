---
id: BL-133
title: Scheduler policy
type: backlog
status: done
summary: A pure scheduler grants step launches under agents.maxConcurrent and per-workflow queues (DES-021).
tags: [core, runs, concurrency]
related: [DES-041, DES-021]
updated: 2026-11-24
priority: P1
depends: [BL-131]
---

# Scheduler policy

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/runs.

Move limits out of the tick into one policy object fed by actor requests.

## Done when

- [x] `request(runId, stepId)`, `release(...)`, `grants()`; no I/O.
- [x] Table tests: global limit, queued runs start in order, cancel frees a slot.
