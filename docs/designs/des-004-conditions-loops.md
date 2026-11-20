---
id: DES-004
title: Conditions and loops
type: design
status: active
summary: Condition kinds (exit, expr, agent) shared by when, until and branches; retry and repeat policies.
tags: [engine, conditions, loops, retry]
related: [DES-002, DES-003]
updated: 2026-11-20
---

# Conditions and loops

## Conditions

| Kind  | Checks                                        | Cost  |
| ----- | --------------------------------------------- | ----- |
| exit  | exit code equals or is in a set               | free  |
| expr  | safe expression over output files             | cheap |
| agent | agent CLI judges output, returns pass or fail | slow  |

Combine with `all` / `any`; cheap kinds evaluate first. The same shape
serves `when`, `until`, and branch edges.

## Loops

- `retry`: on non-zero exit or timeout. Default max 3, backoff 2s doubling.
- `repeat`: on success until `until` passes. Default max 5.
- Separate counters; every launch gets its own `attempt-<n>/`.
