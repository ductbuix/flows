---
id: BL-106
title: Request cancellation in the peer
type: backlog
status: todo
summary: Peer sends and honours $/cancel_request; handlers receive an AbortSignal and a cancelled request ends with the cancelled error.
tags: [protocol, cancellation]
related: [DES-040, DES-042]
updated: 2026-11-24
priority: P0
depends: [BL-105]
---

# Request cancellation in the peer

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/protocol.

Add cancellation to the peer as DES-040 specifies: callers pass an `AbortSignal`, the peer sends `$/cancel_request {id}`, the remote handler's signal aborts, and the request settles with `cancelled` (-32800).

## Done when

- [ ] `request(method, params, { signal })` sends `$/cancel_request` on abort.
- [ ] Handlers get `ctx.signal`; aborting settles the caller with code -32800 and `data.code: cancelled`.
- [ ] Unit tests: cancel before and after the handler starts; late result after cancel is dropped.
