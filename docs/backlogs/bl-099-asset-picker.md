---
id: BL-099
title: Asset picker on the node
type: backlog
status: done
summary: A resource picker on the Asset card, grouped by connection with search, chips for chosen resources, and freshness.
tags: [web, nodes, library]
related: [DES-032, DES-036]
updated: 2026-11-22
priority: P1
depends: [BL-082]
---

# Asset picker on the node

Design: [DES-032](../designs/des-032-node-catalog.md) (Asset), [DES-036](../designs/des-036-canvas-editor-run-view.md) (Nodes). Layer: web only.

## Done when

- [x] The card opens a picker grouped by connection with search, from the connectors registry.
- [x] Chosen resources show as chips with freshness, as on the Library page.
- [x] Test: `apps/e2e/tests/node-asset.spec.ts` picks a repo and a page from the fake connector and saves. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
