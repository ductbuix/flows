---
id: BL-179
title: Workflows and editor page on the sdk
type: backlog
status: todo
summary: The Workflows and editor page reads and writes through sdk-react; its mock store or REST calls are removed.
tags: [web, sdk]
related: [DES-039]
updated: 2026-11-24
priority: P2
depends: [BL-122, BL-175]
---

# Workflows and editor page on the sdk

Design: [DES-039](../designs/des-039-system-architecture-v2.md). Layer: apps/web.

Move one page to the new door (DES-039 M6). Layout follows the mockup and `apps/web/DESIGN.md`.

## Done when

- [ ] Uses `workflow/*` methods; no mock data or `hc` call left in the page.
- [ ] Loading, empty, error and conflict states shown.
- [ ] Playwright spec for the main journey; light and dark screenshots.
