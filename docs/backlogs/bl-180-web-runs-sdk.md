---
id: BL-180
title: Run views page on the sdk
type: backlog
status: done
summary: The Run views page reads and writes through sdk-react; its mock store or REST calls are removed.
tags: [web, sdk]
related: [DES-039]
updated: 2026-11-24
priority: P2
depends: [BL-122, BL-176, BL-141]
---

# Run views page on the sdk

Design: [DES-039](../designs/des-039-system-architecture-v2.md). Layer: apps/web.

Move one page to the new door (DES-039 M6). Layout follows the mockup and `apps/web/DESIGN.md`.

## Done when

- [x] Uses `run/*` methods and `run:<id>` streams; no mock data or `hc` call left in the page.
- [x] Loading, empty, error and conflict states shown.
- [x] Playwright spec for the main journey; light and dark screenshots.
