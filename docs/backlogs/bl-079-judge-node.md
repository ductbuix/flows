---
id: BL-079
title: Judge node in rule mode
type: backlog
status: todo
summary: Judge kind with instructions, CLI, model and effort; first word yes or no picks the branch; unclear fails.
tags: [engine, web, nodes, judge]
related: [DES-032, DES-034]
updated: 2026-11-22
priority: P1
depends: [BL-096]
---

# Judge node in rule mode

Design: [DES-032](../designs/des-032-node-catalog.md) (Judge), [DES-034](../designs/des-034-node-engine.md) (Judge). One kind: three registry files.

## Done when

- [ ] Kind `judge` in the three registries, rule mode: `cli`, `model`, `effort`, instructions in `nodes/<id>/rule.md`; branches `yes` and `no`.
- [ ] The executor reuses `judge.ts` command building; the first word decides; unclear fails with reason `unclear`; the key includes pass and input hash.
- [ ] The taken branch runs and the other is skipped; Judge edges show Yes or No; the run view step shows verdict and rule.
- [ ] Test: `packages/engine/src/nodes/judge.test.ts` (yes, true, no, false, unclear) and `apps/e2e/tests/node-judge.spec.ts` with a new e2e stub `claude` on PATH that answers yes. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
