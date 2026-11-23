---
id: BL-157
title: Docket move
type: backlog
status: todo
summary: docket/move_card {status, beforeId} rewrites status, rank and done date of one card only.
tags: [docket, fcp]
related: [DES-038]
updated: 2026-11-24
priority: P1
depends: [BL-156, BL-152]
---

# Docket move

Design: [DES-038](../designs/des-038-docket-board.md). Layer: packages/core/docket.

Drag on the board is one small write.

## Done when

- [ ] Entering a `done` column sets `done`; leaving clears it.
- [ ] Two moves of different cards never conflict (test).
- [ ] Protocol test.
