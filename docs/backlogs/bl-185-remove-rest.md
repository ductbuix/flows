---
id: BL-185
title: Remove REST routes and the hc client
type: backlog
status: done
summary: Delete REST routes except blobs and health, drop the hc client, and ban it in lint.
tags: [server, web, cleanup]
related: [DES-039]
updated: 2026-11-24
priority: P2
depends: [BL-177, BL-178, BL-179, BL-180, BL-181, BL-182, BL-183, BL-184]
---

# Remove REST routes and the hc client

Design: [DES-039](../designs/des-039-system-architecture-v2.md). Layer: apps/server, apps/web.

One protocol left.

## Done when

- [x] Only `/fcp`, `/blobs` and `/health` remain on the daemon.
- [x] Lint bans `hono/client` in web.
- [x] `pnpm test:e2e` passes.
