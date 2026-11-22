---
id: BL-084
title: Output node targets publish and notify
type: backlog
status: todo
summary: Output target publish runs the DES-026 publish flow from a node; target notify posts an in-app notice; several Outputs allowed.
tags: [engine, web, nodes, publish, connections]
related: [DES-032, DES-026, DES-034]
updated: 2026-11-22
priority: P1
depends: [BL-082]
---

# Output node targets publish and notify

Design: [DES-032](../designs/des-032-node-catalog.md) (Output),
[DES-026](../designs/des-026-work-items-library-connections.md)
(Publish tasks).

## Done when

- [ ] `publish` takes a `connection`; validation needs an upstream Asset
      with `access: propose` on it.
- [ ] The publish flow (change set, policy, ledger, conflicts) runs from
      the Output step with the existing publish events; "Approve each
      publish" stays inside the step.
- [ ] `notify` shows an in-app notice with its title and input text.
- [ ] Several Output nodes in one workflow each run on their own.
- [ ] Tests with the GitHub publish fixtures; Playwright video and
      light and dark screenshots.
