---
id: BL-198
title: "Card panel: refs, properties and links"
type: backlog
status: todo
summary: The card panel shows and edits refs, properties and links as in the mock.
tags: [web, docket, card]
related: [DES-043]
updated: 2026-11-24
priority: P1
depends: [BL-193]
---

# Card panel: refs, properties and links

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Rebuild `RefsSection`, `PropertiesSection` and `LinksSection` on `docket/update_card` and `docket/get_card`. Do not import mock stores.

## Done when

- [ ] Each section edits and saves through FCP with the base hash.
- [ ] A conflict shows the existing conflict alert.
- [ ] e2e covers add, edit and remove of one entry per section.
