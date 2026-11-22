---
id: BL-084
title: Output target publish and Asset propose access
type: backlog
status: todo
summary: Output publish through a connection, gated by policy, with an upstream Asset in propose access.
tags: [engine, web, nodes, publish]
related: [DES-032, DES-026]
updated: 2026-11-22
priority: P1
depends: [BL-082]
---

# Output target publish and Asset propose access

Design: [DES-032](../designs/des-032-node-catalog.md) (Output), [DES-026](../designs/des-026-work-items-library-connections.md) (Publish tasks).

## Done when

- [ ] Asset gains `access: propose`, which gives wired steps the run's work copy.
- [ ] Output `publish` takes a `connection`; validation needs an upstream Asset with `propose` on it.
- [ ] The publish flow (change set, policy, ledger, conflicts) runs from the Output step with the existing publish events; "Approve each publish" stays inside the step.
- [ ] Several Output nodes each run on their own.
- [ ] Test: `packages/engine/src/nodes/output-publish.test.ts` with the GitHub publish fixtures, including a crash between `publish_started` and `publish_finished`. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
