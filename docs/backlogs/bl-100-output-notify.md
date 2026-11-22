---
id: BL-100
title: Output target notify and an in-app notice
type: backlog
status: done
summary: A small in-app notice store and bell, and the Output notify target that posts a title and the input text to it.
tags: [engine, server, web, nodes]
related: [DES-032]
updated: 2026-11-22
priority: P2
depends: [BL-096]
---

# Output target notify and an in-app notice

Design: [DES-032](../designs/des-032-node-catalog.md) (Output). flows has no in-app notice today, so this adds one.

## Done when

- [x] A notice store (events or a table, decided in the PR description) with list and mark-read routes.
- [x] A bell in the sidebar shows unread notices.
- [x] Output `notify` posts `title` and its input text.
- [x] Test: `apps/server/src/notices.test.ts` and `apps/e2e/tests/node-notify.spec.ts`. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
