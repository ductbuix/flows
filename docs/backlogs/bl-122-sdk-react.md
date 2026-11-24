---
id: BL-122
title: sdk-react hooks
type: backlog
status: done
summary: useQuery and useSubscription hooks over the sdk, with refetch on matching updates and on resync.
tags: [sdk, web, react]
related: [DES-039]
updated: 2026-11-24
priority: P1
depends: [BL-120, BL-121]
---

# sdk-react hooks

Design: [DES-039](../designs/des-039-system-architecture-v2.md). Layer: packages/sdk-react (new).

Give pages one data pattern: a query plus the update topics that invalidate it. Same idea as today's websocket invalidation.

## Done when

- [x] `useQuery(method, params, { topics })` returns `{ data, error, loading }` and refetches on a matching update or resync.
- [x] `useSubscription(topic, handler)` for streams (run chunks).
- [x] Component tests with a fake client.
