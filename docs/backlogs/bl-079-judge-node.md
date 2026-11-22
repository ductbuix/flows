---
id: BL-079
title: Judge node with instructions, model and effort
type: backlog
status: todo
summary: Judge node in rule mode, a CLI answers yes or no to custom instructions; branches Yes and No; unclear fails.
tags: [engine, shared, web, nodes, judge]
related: [DES-032, DES-034, DES-023]
updated: 2026-11-22
priority: P1
depends: [BL-075, BL-078]
---

# Judge node with instructions, model and effort

Design: [DES-032](../designs/des-032-node-catalog.md) (Judge),
[DES-034](../designs/des-034-node-engine.md) (Judge).

## Done when

- [ ] Kind `judge` in the three registries, rule mode: `cli`, `model`,
      `effort`, instructions in `nodes/<id>/rule.md`; ports in, then
      `yes` and `no`.
- [ ] The executor reuses `judge.ts` command building; the prompt asks
      for one word; the first word decides; unclear fails with reason
      `unclear`.
- [ ] The cache key includes the pass and an input hash.
- [ ] The taken branch's path runs; the other path is skipped; the
      input is forwarded.
- [ ] The card shows the rule, CLI and model pills, Yes and No ports,
      and marks the taken branch after a run.
- [ ] Engine table tests and one e2e with a stub CLI; Playwright video
      and light and dark screenshots.
