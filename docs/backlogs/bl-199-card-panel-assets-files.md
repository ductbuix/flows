---
id: BL-199
title: "Card panel: assets, item files and ref data"
type: backlog
status: done
summary: The card panel manages owned assets, item files and ref data as in the mock.
tags: [web, docket, assets]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-198]
---

# Card panel: assets, item files and ref data

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Use `docket/add_asset`, `docket/remove_asset`, `file/stat` and `file/reveal`. Include the disk picker and item files dialog.

## Done when

- [x] Add and remove an asset from the panel.
- [x] Item files open in Files.
- [x] e2e covers the flow.
