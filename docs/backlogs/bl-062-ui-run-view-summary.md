---
id: BL-062
title: "Run view: summary first"
type: backlog
status: todo
summary: Run label title, state-based actions, lead Alert or Confirmation, four summary Cards, and Tasks, Changes and Library pins tabs.
tags: [ui, web, runs, ai-elements]
related: [DES-029, DES-027, DES-009]
updated: 2026-11-22
priority: P1
depends: [BL-057, BL-059]
---

# Run view: summary first

Design: [DES-029](../designs/des-029-ui-renovation-run-screens.md) (Run
view). Fixes #26 to #36, S3, S8, S16.

## Done when

- [ ] h1 is the run label with the status Badge; the description shows
      workflow label, relative start, duration and `IdText`; the
      breadcrumb shows the label, not the UUID.
- [ ] Live runs show Cancel (`outline`) and More; finished runs show
      Rerun and More; no Cancel on a finished run.
- [ ] The lead is the Confirmation pattern when a task waits, or
      `Alert variant="destructive"` naming the failed task and attempt
      with an "Open Terminal" button; nothing otherwise.
- [ ] Summary cards:
      `grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4`
      of `Card size="sm"`, 272px wide and 88px tall at 1440x900: Tasks
      with `Progress`, Duration, Work item, Inputs.
- [ ] `Tabs variant="line"`: Tasks, Changes (count), Library pins
      (count); Effects, Changes to publish, unpublished diffs and pins
      live there; an empty tab shows a section `Empty`.
- [ ] At 1440x900 without a lead the Tasks region starts at y300 or
      less.
- [ ] "ws: open" is gone; a secondary Badge "Reconnecting" shows only
      while the socket is down.
- [ ] Evidence: Playwright video plus light and dark screenshots at
      1440x900 of succeeded, failed, awaiting approval and with-inputs
      runs, attached to the PR.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
