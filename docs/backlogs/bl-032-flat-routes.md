---
id: BL-032
title: Flat routes with redirects from nested URLs
type: backlog
status: todo
summary: Routes /runs/:runId and /workflows/:id?tab=, with the old nested run URLs redirecting and every in-app link updated.
tags: [ui, web, routes]
related: [DES-025]
updated: 2026-11-22
priority: P0
depends: []
---

# Flat routes with redirects from nested URLs

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (Shell and navigation). The server already serves
`GET /runs/:runId`; this is a web-only change. Pages keep their
current content; only their URLs move.

## Done when

- [ ] `/runs/:runId` renders the run view; the workflow comes from the
      run, not the URL.
- [ ] `/workflows/:id` reads `tab` (`overview`, `editor`, `runs`); a
      missing or unknown tab shows the editor until BL-037 adds
      Overview.
- [ ] `/workflows/:id/runs` redirects to `/workflows/:id?tab=runs` and
      `/workflows/:id/runs/:runId` to `/runs/:runId`, keeping other
      search params (such as the run view's `view`).
- [ ] Breadcrumbs, sidebar links, toasts and run row links use the new
      URLs. No code builds the nested form.
- [ ] e2e covers both redirects and a deep link to a run.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
