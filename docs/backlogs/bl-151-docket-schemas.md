---
id: BL-151
title: Docket schemas
type: backlog
status: todo
summary: cardSchema, refSchema, assetSchema, linkSchema and boardSchema in contracts, loose with passthrough as DES-038 specifies.
tags: [docket, contracts]
related: [DES-038]
updated: 2026-11-24
priority: P1
depends: [BL-110]
---

# Docket schemas

Design: [DES-038](../designs/des-038-docket-board.md). Layer: packages/contracts.

Types for the board before any store.

## Done when

- [ ] Required: id, title, status, created, updated; unknown keys pass through.
- [ ] Unit tests: minimal card, card with unknown keys keeps them, invalid date warns via a tolerant parse result.
