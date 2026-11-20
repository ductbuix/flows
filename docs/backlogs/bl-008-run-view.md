---
id: BL-008
title: Web run view
type: backlog
status: todo
summary: Web screen that lists runs and shows live task states and logs over the websocket.
tags: [ui, web, runs]
related: [DES-003, DES-008, DES-009]
updated: 2026-11-20
priority: P2
depends: [BL-007]
---

# Web run view

First UI step of the build order. Screen design:
[DES-009](../designs/des-009-run-view.md) (draft). Follow
[DES-008](../designs/des-008-ui.md).

## Done when

- [x] A design doc for the screen exists (DES-009).
- [ ] DES-009 open questions answered and its status set to `active`.
- [ ] Request and websocket shapes are zod schemas in `packages/shared`.
- [ ] Task states and logs update live from websocket events.
- [ ] Playwright test with video and screenshots; `pnpm test:e2e` passes.
