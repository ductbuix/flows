---
id: BL-174
title: File methods
type: backlog
status: todo
summary: file/list, stat, read_text, write_text (baseHash) and reveal over FCP for workspace folders.
tags: [files, fcp]
related: [DES-040]
updated: 2026-11-24
priority: P2
depends: [BL-126, BL-115]
---

# File methods

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/core/files.

Back the Files mockup page.

## Done when

- [ ] Paths are confined to allowed roots; outside is `policy_denied`.
- [ ] Protocol tests including a `..` escape.
