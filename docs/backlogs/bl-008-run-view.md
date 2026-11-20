---
id: BL-008
title: Web run view
type: backlog
status: todo
summary: Run view with list and graph views, live task states, attempt kinds, logs and rendered SUMMARY.md.
tags: [ui, web, runs]
related: [DES-003, DES-008, DES-009, DES-012]
updated: 2026-11-21
priority: P2
depends: [BL-007]
---

# Web run view

First UI step of the build order. Screen design:
[DES-009](../designs/des-009-run-view.md) (active). Libraries:
[DES-012](../designs/des-012-ui-libraries.md). Run actions are BL-012.

## Done when

- [x] DES-009 written, open questions answered, status `active`.
- [ ] `FLOWAPP_HOME` overrides the app home (DES-002); e2e uses a temp dir.
- [ ] Request and websocket shapes are zod schemas in `packages/shared`.
- [ ] Task states and logs update live from websocket events.
- [ ] List and graph views switch with shared selection, kept in the URL.
- [ ] Attempt badges show kind with icon and text (Run, Retry n/max,
      Repeat n/max, Manual retry, Interrupted), not color alone.
- [ ] `SUMMARY.md` renders with react-markdown and remark-gfm; raw HTML is
      not rendered (unit test with a `<script>` and a `javascript:` link).
- [ ] Playwright tests from DES-009 with video and screenshots;
      `pnpm test:e2e` passes.
