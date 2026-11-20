---
id: BL-006
title: Conditions and loops
type: backlog
status: done
summary: exit and expr conditions for when, until and branches; retry and repeat with separate counters.
tags: [engine, conditions, loops, retry]
related: [DES-004]
updated: 2026-11-21
priority: P1
depends: [BL-005]
---

# Conditions and loops

Spec: [DES-004](../designs/des-004-conditions-loops.md). The agent judge
condition is BL-011.

## Done when

- [x] `exit` and `expr` conditions, combined with `all` and `any`, work for
      `when`, `until` and branch edges.
- [x] `when: false` skips a task and skips propagate as in DES-003.
- [x] `retry` (default max 3, backoff 2s doubling) and `repeat` (default
      max 5) keep separate counters, one `attempt-<n>/` per launch.
- [x] Tests cover each condition kind and both loop kinds.
