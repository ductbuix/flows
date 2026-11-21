---
id: BL-031
title: Shared page patterns, status Badges and /dev/kit
type: backlog
status: todo
summary: Title block, section, run status Badge and a dev-only /dev/kit page in light and dark, plus a lint rule on shadcn size classes.
tags: [ui, web, shadcn, lint]
related: [DES-025, DES-024]
updated: 2026-11-22
priority: P0
depends: []
---

# Shared page patterns, status Badges and /dev/kit

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (One component per job, Layout rules, Developer
experience). Web only; no API change. Later pages import these parts
instead of restyling shadcn.

Out of scope: impact, policy and freshness Badges (they land with the
data in BL-045 and BL-051), any page layout change.

## Done when

- [ ] `PageTitle` (title, one muted sentence, optional Badge) and
      `Section` (`h2 font-heading text-base`, `gap-3`) exist in
      `apps/web` and are used by Settings.
- [ ] `RunStatusBadge` maps queued, running, succeeded, failed,
      cancelled and "awaiting approval" (any task in
      `awaiting_approval`) to the variant and icon in DES-025.
      Existing run badges use it.
- [ ] `/dev/kit` renders title block, Section, every run status Badge,
      a task Card, Confirmation and Plan. The route exists only when
      `import.meta.env.DEV` is true.
- [ ] The lint guard rejects `className` size or radius tokens (`h-*`,
      `size-*`, `rounded-*`) on shadcn parts from `@workspace/ui`,
      with a unit test like `tailwind-class-guard.test.ts`.
- [ ] Playwright screenshots `/dev/kit` in light and dark.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
