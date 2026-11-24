---
id: BL-212
title: "Remove /mock redirects and Mock names"
type: backlog
status: done
summary: Delete /mock/* routes, MockShell, MockSidebar and test ids that say mock.
tags: [web, cleanup, mock]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-211]
---

# Remove /mock redirects and Mock names

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web, apps/e2e.

Rename to `AppShell` and `AppSidebar`. Update test ids and e2e.

## Done when

- [x] No `Mock` name or `mock-` test id remains in `apps/web`.
- [x] `pnpm test:e2e` passes.
