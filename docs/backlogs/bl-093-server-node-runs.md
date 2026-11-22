---
id: BL-093
title: "Server: start, cancel and watch node runs behind a flag"
type: backlog
status: done
summary: Behind FLOWS_NODES, start a node run, cancel it, retry a step, list and read runs from the step fold, and push step events.
tags: [server, api, runs, nodes]
related: [DES-034, DES-021]
updated: 2026-11-22
priority: P0
depends: [BL-091, BL-092]
---

# Server: start, cancel and watch node runs behind a flag

Design: [DES-034](../designs/des-034-node-engine.md), [DES-037](../designs/des-037-node-delivery.md) (Rollout). Layer: server only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [x] Start run calls `startNodeRun`, freezes the graph and copies the layout to `runs/<runId>/layout.json`; the queue and `maxConcurrentRuns` work as today.
- [x] Cancel and manual retry (`step_retry_requested`) work for node runs.
- [x] Run list and run detail map node runs from the step fold; the websocket hub forwards step events.
- [x] Test: `apps/server/src/node-runs.test.ts`: start with Trigger, Command, Output to `run_succeeded`; cancel; retry a failed step; websocket receives `step_done`.
