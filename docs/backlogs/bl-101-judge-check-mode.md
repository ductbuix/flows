---
id: BL-101
title: Judge check mode
type: backlog
status: todo
summary: Judge tests a named answer with OpenBot's operators and no model call.
tags: [engine, web, judge]
related: [DES-032]
updated: 2026-11-22
priority: P2
depends: [BL-085, BL-079]
---

# Judge check mode

Design: [DES-032](../designs/des-032-node-catalog.md) (Judge). Waits on DES-031 open question 3.

## Done when

- [ ] Judge `mode: check` with `check` (field, operator, value), operators as DES-032.
- [ ] It evaluates in the tick with no process and holds no slot.
- [ ] Test: `packages/engine/src/nodes/judge-check.test.ts`, one case per operator. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
