---
id: BL-082
title: Asset node for library resources
type: backlog
status: todo
summary: Asset node lists chosen GitHub repos and pulled Confluence pages, pins them at start, and feeds them to wired steps.
tags: [engine, shared, web, nodes, library, connections]
related: [DES-032, DES-026, DES-035]
updated: 2026-11-22
priority: P1
depends: [BL-075, BL-078]
---

# Asset node for library resources

Design: [DES-032](../designs/des-032-node-catalog.md) (Asset),
[DES-026](../designs/des-026-work-items-library-connections.md).

## Done when

- [ ] Kind `asset` with `resources` (`connection`, `entity`, `id`) and
      `access` (`read` or `propose`); sources come from the connectors
      registry.
- [ ] Run start pulls and pins every Asset resource with the work
      item's links, as DES-026 pinning does.
- [ ] The step emits the pinned folders on `file` and an index on
      `text`; wired steps get `RESOURCE_<ID>`; `propose` uses the work
      copy.
- [ ] The card has a picker grouped by connection with search, chips
      for chosen resources, and freshness.
- [ ] Tests with the GitHub and Confluence connectors' fixtures;
      Playwright video and light and dark screenshots.
