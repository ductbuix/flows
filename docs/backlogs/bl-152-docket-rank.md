---
id: BL-152
title: Fractional rank
type: backlog
status: done
summary: "rank.ts: a key between two keys, lexicographic, short strings, for one-file card moves."
tags: [docket, core]
related: [DES-038]
updated: 2026-11-24
priority: P1
depends: []
---

# Fractional rank

Design: [DES-038](../designs/des-038-docket-board.md). Layer: packages/core/docket.

Moves rewrite one card only.

## Done when

- [x] `rankBetween(a?, b?)` always returns a key strictly between; keys stay short over many inserts.
- [x] Property test with 10 000 random inserts.
