---
id: BL-120
title: packages/sdk FlowsClient
type: backlog
status: done
summary: "Typed client generated from the method table: connect, initialize, call, notifications, reconnect with backoff."
tags: [sdk, protocol]
related: [DES-039, DES-040]
updated: 2026-11-24
priority: P0
depends: [BL-105, BL-111]
---

# packages/sdk FlowsClient

Design: [DES-039](../designs/des-039-system-architecture-v2.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/sdk (new).

One client every UI uses. `client.call('docket/get_card', params)` is typed from contracts.

## Done when

- [x] `createClient({ transport | url, token, capabilities })`; calls before ready are queued.
- [x] Reconnect with capped exponential backoff; pending calls fail with a retryable error on drop.
- [x] Unit tests over linked transports with a fake engine.
