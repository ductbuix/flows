---
id: BL-124
title: run/list, run/get and run_changed over FCP
type: backlog
status: done
summary: Read runs through FCP and push run/update run_changed when the run list changes.
tags: [fcp, runs]
related: [DES-040]
updated: 2026-11-24
priority: P0
depends: [BL-118, BL-119]
---

# run/list, run/get and run_changed over FCP

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: apps/server.

Second slice: a query plus an update stream, backed by today's run summary and `runs_changed`.

## Done when

- [x] `run/list` pages by cursor; `run/get` returns the run summary.
- [x] Today's `runs_changed` event publishes `run/update { kind: run_changed }` on the bus.
- [x] Integration test: start a run via REST, see `run_changed` on an FCP subscriber.
