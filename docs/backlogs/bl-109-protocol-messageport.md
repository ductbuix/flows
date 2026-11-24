---
id: BL-109
title: MessagePort transport
type: backlog
status: done
summary: Transport over a MessagePort (structured clone), for Electron renderer to utility process and for workers.
tags: [protocol, electron]
related: [DES-040, DES-039]
updated: 2026-11-24
priority: P2
depends: [BL-105]
---

# MessagePort transport

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-039](../designs/des-039-system-architecture-v2.md). Layer: packages/protocol.

Add `messagePortTransport(port)` for any port with `postMessage`/`onmessage` (DOM `MessagePort`, Electron `MessagePortMain`, `worker_threads`).

## Done when

- [x] Messages are posted as plain objects, no JSON string round trip.
- [x] Closing either end calls `onClose` on the other where the platform reports it.
- [x] Unit test with `node:worker_threads` `MessageChannel`.
