---
id: BL-171
title: Library provider descriptors
type: backlog
status: todo
summary: Providers are data (pattern, layout, tags, access, fetch) with library/list_providers and save_provider over FCP.
tags: [library, fcp]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-115]
---

# Library provider descriptors

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/contracts, packages/core/library.

Add a system without a release, as the mockup's `library-providers.ts` shows.

## Done when

- [ ] Pattern needs a named group `id`; invalid regex is `invalid_params`.
- [ ] Presets ship for GitHub, Confluence and Rally.
- [ ] Tests: link recognition per preset.
