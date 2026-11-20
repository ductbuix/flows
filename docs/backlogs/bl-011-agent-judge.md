---
id: BL-011
title: Agent judge conditions
type: backlog
status: done
summary: agent condition kind where an agent CLI judges output and returns pass or fail.
tags: [engine, conditions, agents]
related: [DES-004, DES-007]
updated: 2026-11-21
priority: P2
depends: [BL-006, BL-007]
---

# Agent judge conditions

Spec: [DES-004](../designs/des-004-conditions-loops.md). Last in the build
order with sandboxing.

## Done when

- [x] `agent` conditions work in `when`, `until` and branch edges.
- [x] Cheap kinds evaluate before the agent judge in `all` and `any`.
- [x] A test with a stub agent CLI covers pass and fail.
