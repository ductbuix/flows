---
id: BL-008
title: Web run view
type: backlog
status: todo
summary: Web screen that lists runs and shows live task states and logs over the websocket.
tags: [ui, web, runs]
related: [DES-003, DES-008]
updated: 2026-11-20
priority: P2
depends: [BL-007]
---

# Web run view

First UI step of the build order. Follow [DES-008](../designs/des-008-ui.md)
and write a UI design doc for the screen before building it.

## Done when

- [ ] A design doc for the screen exists under `docs/designs/`.
- [ ] Task states and logs update live from websocket events.
- [ ] Playwright test with video and screenshots; `pnpm test:e2e` passes.
