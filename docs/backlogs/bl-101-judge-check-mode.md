---
id: BL-101
title: Judge check mode
type: backlog
status: done
summary: Judge tests a named answer with OpenBot's operators and no model call.
tags: [engine, web, judge]
related: [DES-032]
updated: 2026-11-22
priority: P2
depends: [BL-085, BL-079]
---

# Judge check mode

Design: [DES-032](../designs/des-032-node-catalog.md) (Judge). Open question 3 of DES-031 is settled: both modes stay.

## Done when

- [x] Judge `mode: check` with `check` (field, operator, value), operators as DES-032.
- [x] It evaluates in the tick with no process and holds no slot.
- [x] Test: `packages/engine/src/nodes/judge-check.test.ts`, one case per operator. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
