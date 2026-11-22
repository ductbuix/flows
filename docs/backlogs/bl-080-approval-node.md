---
id: BL-080
title: Approval node
type: backlog
status: todo
summary: Approval node with a question; waits with no slot, Approve forwards, Reject stops the run; shows in Needs you.
tags: [engine, web, nodes, approval]
related: [DES-032, DES-034, DES-029]
updated: 2026-11-22
priority: P1
depends: [BL-096]
---

# Approval node

Design: [DES-032](../designs/des-032-node-catalog.md) (Approval), [DES-034](../designs/des-034-node-engine.md) (Approval). One kind: three registry files.

## Done when

- [ ] Kind `approval` with an inline `question`.
- [ ] The step appends `approval_requested`, holds no slot and survives a restart.
- [ ] Approve forwards the input; Reject appends `step_rejected` and the run ends `run_cancelled` with reason `rejected`.
- [ ] The card shows Approve and Reject while waiting; Home's Needs you and the run view lead show it; the run view step shows the decision.
- [ ] Test: `packages/engine/src/nodes/approval.test.ts` (restart while waiting, approve, reject) and `apps/e2e/tests/node-approval.spec.ts`. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
