---
id: BL-105
title: JSON-RPC peer and linked transports
type: backlog
status: todo
summary: New packages/protocol with a JSON-RPC 2.0 peer (requests, results, errors, notifications) and an in-memory linked transport pair.
tags: [protocol, json-rpc]
related: [DES-040, DES-039]
updated: 2026-11-24
priority: P0
depends: []
---

# JSON-RPC peer and linked transports

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-039](../designs/des-039-system-architecture-v2.md). Layer: packages/protocol (new).

Create `packages/protocol` with the `Transport` interface from DES-040 and one `RpcPeer` that both sides use: send requests with id correlation, answer them, send and receive notifications, map thrown errors to JSON-RPC errors. Add `createLinkedTransports()` for tests. No framing, no domain types.

## Done when

- [ ] `packages/protocol` exists, imports nothing in the repo except `contracts` types (none needed yet) and builds in the workspace.
- [ ] Peer supports `request`, `notify`, `onRequest(method, handler)`, `onNotification(method, handler)` and rejects pending requests when the transport closes.
- [ ] Unit tests over linked transports: round trip, unknown method gives -32601, handler error gives an error response, close rejects pending.
