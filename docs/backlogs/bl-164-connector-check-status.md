---
id: BL-164
title: Connector check and expired sign-ins
type: backlog
status: todo
summary: connector/check updates status and posts an Inbox item when a sign-in has expired.
tags: [connectors, inbox]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-161, BL-145]
---

# Connector check and expired sign-ins

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/connectors.

Expired sign-ins surface where a person acts.

## Done when

- [ ] `connector/update status_changed`; `expired` adds a sign-in item, `connected` resolves it.
- [ ] Service test on fakes.
