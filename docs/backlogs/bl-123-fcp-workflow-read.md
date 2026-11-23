---
id: BL-123
title: workflow/list and workflow/get over FCP
type: backlog
status: todo
summary: "First real methods: list and get workflows through FCP, backed by today's engine functions."
tags: [fcp, workflows]
related: [DES-040, DES-039]
updated: 2026-11-24
priority: P0
depends: [BL-118]
---

# workflow/list and workflow/get over FCP

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-039](../designs/des-039-system-architecture-v2.md). Layer: packages/contracts, apps/server.

Prove the path end to end with read-only calls. Handlers call the same functions the REST routes call.

## Done when

- [ ] Method declarations in contracts; handlers registered in the daemon.
- [ ] Results match the REST responses for the same workflow (test compares them).
- [ ] Integration test over `/fcp` with a temp `FLOWAPP_HOME`.
