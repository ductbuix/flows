---
id: BL-216
title: "e2e and layout baselines to the mock screens"
type: backlog
status: done
summary: Specs and layout baselines cover the mock screens and no old page.
tags: [e2e, web]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-209, BL-212]
---

# e2e and layout baselines to the mock screens

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/e2e.

Replace specs for removed pages. Refresh `layout.spec.ts` baselines. Add a spec per checklist area.

## Done when

- [x] Every checklist row has a passing spec.
- [x] No spec visits a removed route.
