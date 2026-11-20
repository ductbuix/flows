---
id: DES-003
title: Task lifecycle, engine and concurrency
type: design
status: active
summary: Task state machine, append-then-act event log, scheduler tick, resume rules and nested limits.
tags: [engine, lifecycle, events, resume, concurrency]
related: [DES-001, DES-004, DES-005]
updated: 2026-11-20
---

# Task lifecycle, engine and concurrency

## Task lifecycle

`pending -> ready -> running -> (condition) -> succeeded | failed`, with
`pending -> skipped` when `when` is false and `running -> running` for
retry or repeat. Skips propagate unless a dependant allows `skipped`. A
failure fails the run unless `continueOnError`.

## Engine

1. Append, then act: every change is an event written in a transaction
   before its side effect.
2. State is a fold over events; the scheduler keeps no state outside the
   log.
3. Each event triggers a tick: compute ready tasks, apply limits, spawn
   processes (detached, own process group), stream logs to files and the
   websocket.
4. Resume: replay the log; for started attempts with no exit, re-attach by
   pid if alive, else record `interrupted` and apply retry policy. Finished
   tasks never rerun.
5. Attempt ids are written before launch so a crash cannot start a
   duplicate.

## Concurrency

Nested limits: global, workflow, run, task group. A task starts only when
it fits under every level. Agent tasks also count against an `agents`
limit at each level. Global limits live in `~/.flowapp/config.yaml`,
workflow limits in `workflow.yaml` ([DES-002](des-002-workflow-files.md)).
