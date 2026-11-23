---
id: BL-107
title: Newline-delimited JSON transport over streams
type: backlog
status: done
summary: A Transport over a readable and writable stream pair, one JSON message per line, for stdio peers (ACP agents, flows --stdio).
tags: [protocol, stdio]
related: [DES-040, DES-041]
updated: 2026-11-24
priority: P0
depends: [BL-105]
---

# Newline-delimited JSON transport over streams

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-041](../designs/des-041-engine-core.md). Layer: packages/protocol (node entry).

Add `ndjsonTransport(readable, writable)` under a Node-only entry point (`protocol/node`) so the browser bundle never pulls Node streams.

## Done when

- [x] Splits on `\n`, handles messages split across chunks and several messages in one chunk.
- [x] A malformed line is reported through `onError` and skipped, the stream keeps working.
- [x] Unit tests with `PassThrough` streams; the default entry has no `node:` import (lint).
