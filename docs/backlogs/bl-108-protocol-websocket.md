---
id: BL-108
title: WebSocket transport
type: backlog
status: done
summary: Transport for one WebSocket, usable from the browser and from Node, one JSON text frame per message.
tags: [protocol, websocket]
related: [DES-040]
updated: 2026-11-24
priority: P0
depends: [BL-105]
---

# WebSocket transport

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/protocol.

Add `wsTransport(socket)` that takes any object with the standard WebSocket shape (browser `WebSocket` or `ws`), so client and server share it.

## Done when

- [x] Text frames parse to messages; binary frames are rejected with a logged error.
- [x] Close and error events reach `onClose`.
- [x] Unit test against a local `ws` server on `127.0.0.1` with a random port.
