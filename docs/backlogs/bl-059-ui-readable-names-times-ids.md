---
id: BL-059
title: "UI labels: readable names, relative times, IdText"
type: backlog
status: done
summary: workflowLabel, runLabel, RelativeTime and IdText; readable labels first everywhere, ids secondary mono with copy.
tags: [ui, web, ux, dx]
related: [DES-027, DES-029, DES-030, BL-073]
updated: 2026-11-22
priority: P0
depends: [BL-057, BL-073]
---

# UI labels: readable names, relative times, IdText

Design: [DES-030](../designs/des-030-ui-renovation-journeys-dx.md) (DX
for people using Flows),
[DES-029](../designs/des-029-ui-renovation-run-screens.md) (readable run
label). Fixes S11 and the time part of S16.

## Done when

- [x] `apps/web/src/lib/labels.ts` exports `workflowLabel` (from
      BL-073: `name`, else "feature-spec" becomes "Feature spec"), `runLabel` (work item
      title, else "Ad hoc run"), `formatRelative` and `formatDuration`,
      with unit tests.
- [x] `components/data/RelativeTime` shows "just now" under 45s, "3 min
      ago", "2 h ago", "yesterday", then a short local date; its Tooltip
      shows the absolute local time with the zone; it refreshes every
      30s.
- [x] `components/data/IdText` renders
      `font-mono text-xs text-muted-foreground`, cuts UUIDs to 8
      characters, has a `ghost` `icon-xs` copy button with Tooltip "Copy
      id", and toasts "Copied".
- [x] Sidebar, breadcrumbs, titles and tables show labels in Geist; no
      raw UUID or ISO timestamp is a primary label on Home, Runs, Run
      view or Library.
- [x] Status Badge mappings move to `components/data/`.
