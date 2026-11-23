---
id: BL-116
title: FCP initialize and capabilities
type: backlog
status: todo
summary: initialize handshake with protocolVersion, client and engine info and capabilities; calls before initialize are rejected.
tags: [protocol, fcp]
related: [DES-040]
updated: 2026-11-24
priority: P0
depends: [BL-115]
---

# FCP initialize and capabilities

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/contracts, packages/core/rpc.

Implement the DES-040 lifecycle step 1-2 so every host negotiates the same way.

## Done when

- [ ] `initialize` schema in contracts; engine answers with `engineCapabilities` (agents and nodeKinds empty for now).
- [ ] Any other method before `initialize` fails with `invalid_request`.
- [ ] Unit tests: version match, older client version, call before initialize.
