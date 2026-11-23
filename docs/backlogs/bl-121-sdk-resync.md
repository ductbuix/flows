---
id: BL-121
title: sdk resubscribe and resync
type: backlog
status: done
summary: On reconnect the sdk resubscribes with its last seq and emits resync events so callers refetch.
tags: [sdk, protocol]
related: [DES-040]
updated: 2026-11-24
priority: P0
depends: [BL-119, BL-120]
---

# sdk resubscribe and resync

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/sdk.

Make reconnect invisible to pages except for a refetch.

## Done when

- [x] The client tracks the highest `seq` per connection and sends it on resubscribe.
- [x] `client.on('resync', topic)` fires for each topic the engine lists.
- [x] Unit test: drop the transport mid-stream, reconnect, receive replayed updates in order.
