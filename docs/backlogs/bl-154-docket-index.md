---
id: BL-154
title: Docket index projection
type: backlog
status: done
summary: In-memory index of card faces, backlinks and missing linked assets, rebuilt from files and kept live by the watcher.
tags: [docket, core]
related: [DES-038, DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-153, BL-127]
---

# Docket index projection

Design: [DES-038](../designs/des-038-docket-board.md), [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/docket.

Fast board lists without a second source of truth.

## Done when

- [x] Index rebuilds from files on start; a file change updates one entry.
- [x] Backlinks computed from links; unknown status goes to Unsorted.
- [x] Tests: hand edit on disk shows up; dangling link flagged.
