---
id: BL-210
title: "Settings panel and trust methods"
type: backlog
status: done
summary: Settings opens from the sidebar footer as a panel; CLI, trust and MCP trust have FCP methods.
tags: [web, settings, trust, fcp]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-193]
---

# Settings panel and trust methods

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web, packages/contracts, apps/server.

Add FCP methods for CLI settings, app trust and MCP trust. Remove the `/settings` route. Keep theme.

## Done when

- [x] Cursor trust and MCP trust can be set from the panel.
- [x] `/settings` is not a route.
