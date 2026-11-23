---
id: BL-145
title: Inbox projection and inbox methods
type: backlog
status: todo
summary: Inbox items are a projection over run events; inbox/list, inbox/answer and inbox/dismiss over FCP, starting with approvals.
tags: [inbox, fcp, core]
related: [DES-041, DES-040]
updated: 2026-11-24
priority: P1
depends: [BL-119, BL-132]
---

# Inbox projection and inbox methods

Design: [DES-041](../designs/des-041-engine-core.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/core/inbox.

Back the Inbox mockup page with one projection any client can answer.

## Done when

- [ ] Approval waits appear as items; `inbox/answer` routes to the run actor; the item resolves on the answer event.
- [ ] `inbox/update` `item_added` and `item_resolved`.
- [ ] Service tests on fakes; rebuild from events gives the same items.
