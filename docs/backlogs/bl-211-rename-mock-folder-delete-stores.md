---
id: BL-211
title: "Rename pages/mock and delete mock stores"
type: backlog
status: done
summary: Move shared components to their area folders; delete every *-store.ts and *-data.ts.
tags: [web, cleanup, mock]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends:
  [BL-198, BL-199, BL-201, BL-202, BL-204, BL-205, BL-206, BL-207, BL-208]
---

# Rename pages/mock and delete mock stores

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

After the UI rebuilds, no code reads fake data. Move what remains to `pages/<area>/` and `components/`.

## Done when

- [x] `apps/web/src/pages/mock` does not exist.
- [x] `git grep -E '(store|data)\.ts'` finds no mock stores.
- [x] Lint rule bans importing `pages/mock`.
