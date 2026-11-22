---
id: BL-082
title: Asset node with read access
type: backlog
status: todo
summary: Asset kind listing library resources; pulled and pinned at run start; emits pinned folders and an index; read access only.
tags: [engine, nodes, library]
related: [DES-032, DES-026]
updated: 2026-11-22
priority: P1
depends: [BL-096]
---

# Asset node with read access

Design: [DES-032](../designs/des-032-node-catalog.md) (Asset), [DES-026](../designs/des-026-work-items-library-connections.md). Resources are edited in YAML and the node Sheet as a plain list here; the picker is BL-099.

## Done when

- [ ] Kind `asset` with `resources` (`connection`, `entity`, `id`) and `access: read`.
- [ ] Run start pulls and pins every Asset resource with the work item's links, as DES-026 pinning does.
- [ ] The step emits pinned folders on `file` and an index on `text`; wired steps get `RESOURCE_<ID>`.
- [ ] Test: `packages/engine/src/nodes/asset.test.ts` with the fake connector (`FLOWAPP_FAKE_CONNECTOR`) and the GitHub and Confluence fixtures. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
