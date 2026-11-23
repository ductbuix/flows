---
id: BL-159
title: Run refs on cards
type: backlog
status: todo
summary: When a run started from a card finishes, the card gets or updates a flows-run ref.
tags: [docket, runs]
related: [DES-038, DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-156, BL-132]
---

# Run refs on cards

Design: [DES-038](../designs/des-038-docket-board.md), [DES-041](../designs/des-041-engine-core.md). Layer: packages/core.

Run history stays linked without the board owning run state (domain event between contexts).

## Done when

- [ ] Listens to `run.finished`; one ref per run, label shows workflow and result.
- [ ] Service test on fakes.
