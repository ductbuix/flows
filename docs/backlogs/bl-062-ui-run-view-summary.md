---
id: BL-062
title: "Run view: summary first"
type: backlog
status: done
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

- [x] h1 is the run label with the status Badge; the description shows
      workflow label, relative start, duration and `IdText`; the
      breadcrumb shows the label, not the UUID.
- [x] Live runs show Cancel (`outline`) and More; finished runs show
      Rerun and More; no Cancel on a finished run.
- [x] The lead is the Confirmation pattern when a task waits, or
      `Alert variant="destructive"` naming the failed task and attempt
      with an "Open Terminal" button; nothing otherwise.
- [x] Summary cards:
      `grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4`
      of `Card size="sm"`, 272px wide and 88px tall at 1440x900: Tasks
      with `Progress`, Duration, Work item, Inputs.
- [x] `Tabs variant="line"`: Tasks, Changes (count), Library pins
      (count); Effects, Changes to publish, unpublished diffs and pins
      live there; an empty tab shows a section `Empty`.
- [x] At 1440x900 without a lead the Tasks region starts at y300 or
      less.
- [x] "ws: open" is gone; a secondary Badge "Reconnecting" shows only
      while the socket is down.

## Notes

- `RunDetail` gained `workItemId` (it was read by the page but never sent).
- Header actions sit in the page header; Cancel shows only on live runs.
- The Plan, `RunHeader`, the stale Alert and "ws: open" are removed. The
  List or Graph switch stays a `ToggleGroup` in the Tasks tab toolbar;
  BL-063 owns the rest of the Tasks tab.
- Auto-select (`defaultTask`) and the failed-run Terminal tab landed here
  because the tab content needed a selected task; BL-063 can build on it.
- The Changes badge counts effects; unpublished diffs load inside the tab.
