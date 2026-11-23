---
id: BL-175
title: Workflow writes over FCP
type: backlog
status: todo
summary: workflow/create, save (baseHash), rename, delete (busy while live), save_layout and validate over FCP.
tags: [workflows, fcp]
related: [DES-040]
updated: 2026-11-24
priority: P1
depends: [BL-123]
---

# Workflow writes over FCP

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: apps/server, packages/core.

Editor needs writes before it can leave REST.

## Done when

- [ ] Same rules as the REST routes (409 becomes `conflict`, live run delete becomes `busy`).
- [ ] `workflow/update` notifications.
- [ ] Protocol tests.
