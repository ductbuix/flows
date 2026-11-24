---
id: BL-176
title: Run commands over FCP
type: backlog
status: done
summary: run/start (requestKey), cancel, rerun, retry_step, delete, get_log and get_changes over FCP.
tags: [runs, fcp]
related: [DES-040]
updated: 2026-11-24
priority: P1
depends: [BL-124]
---

# Run commands over FCP

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: apps/server, packages/core.

Run controls for every client.

## Done when

- [x] `run/start` returns `{ runId }` at once; a repeated `requestKey` returns the same run.
- [x] `step_state` and `run_finished` updates.
- [x] Protocol tests, including the idempotent start.
