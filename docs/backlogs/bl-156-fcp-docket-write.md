---
id: BL-156
title: Docket create, update and delete
type: backlog
status: todo
summary: docket/create_card, update_card (baseHash), delete_card and save_board over FCP, with docket/update notifications.
tags: [docket, fcp]
related: [DES-038, DES-040]
updated: 2026-11-24
priority: P1
depends: [BL-155, BL-119]
---

# Docket create, update and delete

Design: [DES-038](../designs/des-038-docket-board.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/core/docket.

Edit cards from any client with the conflict rule.

## Done when

- [ ] Stale `baseHash` fails with `conflict` and the current card.
- [ ] `card_changed`, `card_removed`, `board_changed` updates; deleting a column lists affected cards first.
- [ ] Protocol tests including conflict.
