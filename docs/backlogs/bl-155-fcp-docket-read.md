---
id: BL-155
title: Docket read methods
type: backlog
status: done
summary: docket/get_board, docket/list_cards (faces) and docket/get_card (body, hash, backlinks, asset states) over FCP.
tags: [docket, fcp]
related: [DES-038, DES-040]
updated: 2026-11-24
priority: P1
depends: [BL-154, BL-115]
---

# Docket read methods

Design: [DES-038](../designs/des-038-docket-board.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/contracts, packages/core.

Read side of the Docket page.

## Done when

- [x] Lists page by cursor; faces carry no body.
- [x] Protocol test over linked transports with fixture cards.
