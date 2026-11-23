---
id: BL-158
title: Docket assets
type: backlog
status: todo
summary: docket/add_asset (owned via blob upload or linked by path) and remove_asset; owned file deletion is a separate confirmed call.
tags: [docket, assets, fcp]
related: [DES-038, DES-040]
updated: 2026-11-24
priority: P2
depends: [BL-156, BL-130]
---

# Docket assets

Design: [DES-038](../designs/des-038-docket-board.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/core/docket.

Attach files the way DES-038 Asset describes.

## Done when

- [ ] Owned uploads land in `assets/`; linked paths are stored, never copied; missing linked paths flagged.
- [ ] Removing an entry never deletes the target file.
- [ ] Protocol tests for both scopes.
