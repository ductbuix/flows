---
id: BL-190
title: Browser sign-in through the desktop app
type: backlog
status: todo
summary: host/browser_sign_in opens an Electron window for the connector URL and returns cookies for the listed domains only.
tags: [desktop, connectors, security]
related: [DES-040, DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-186, BL-162]
---

# Browser sign-in through the desktop app

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-041](../designs/des-041-engine-core.md). Layer: apps/desktop, packages/core/connectors.

Cookie sign-in without driving Chrome when the desktop app is the client.

## Done when

- [ ] Separate session partition per connector; only `cookieDomains` cookies are returned; cancel returns `cancelled`.
- [ ] Without the capability the engine keeps today's Chrome sign-in.
