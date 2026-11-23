---
id: BL-119
title: Update bus, subscribe and resync
type: backlog
status: todo
summary: UpdateBus with engine-wide seq, subscribe/unsubscribe by topic, a bounded replay buffer and resync when the buffer is short.
tags: [core, protocol, fcp]
related: [DES-040, DES-041]
updated: 2026-11-24
priority: P0
depends: [BL-115]
---

# Update bus, subscribe and resync

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-041](../designs/des-041-engine-core.md). Layer: packages/core.

Give every update stream one ordering and one recovery path, as DES-040 Subscriptions describes.

## Done when

- [ ] `subscribe({ topics, since })` returns `{ seq, resync }`; updates carry `seq`; `run:<id>` topics filter heavy kinds.
- [ ] Replay buffer is bounded (setting); a `since` older than it lists the topic in `resync`.
- [ ] Unit tests: ordering, replay, resync, unsubscribe on peer close.
