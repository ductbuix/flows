---
id: BL-118
title: Daemon serves FCP on /fcp
type: backlog
status: done
summary: The server accepts WebSocket connections on /fcp, checks Origin and the lock token, and binds an FCP peer per socket.
tags: [server, protocol, fcp]
related: [DES-040, DES-039]
updated: 2026-11-24
priority: P0
depends: [BL-108, BL-116, BL-117]
---

# Daemon serves FCP on /fcp

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-039](../designs/des-039-system-architecture-v2.md). Layer: apps/server.

Open the new door next to the REST API. Nothing in the web uses it yet.

## Done when

- [x] `/fcp` on `127.0.0.1:8787`; wrong Origin or token closes with 4401.
- [x] The index page served by the daemon exposes the token to same-origin scripts only.
- [x] Integration test: a Node client connects, initializes and calls `ping`.
