---
id: BL-114
title: Package dependency rules in lint
type: backlog
status: done
summary: Lint enforces the DES-042 dependency rules between packages and bans import cycles.
tags: [lint, architecture]
related: [DES-042, DES-039]
updated: 2026-11-24
priority: P1
depends: [BL-113]
---

# Package dependency rules in lint

Design: [DES-042](../designs/des-042-engine-patterns-standards.md), [DES-039](../designs/des-039-system-architecture-v2.md). Layer: eslint config.

Turn the DES-039 package table into lint rules so the layering cannot drift.

## Done when

- [x] Rules: contracts imports nothing; core no Node; adapters never import other adapters; web never imports core, engine or adapters.
- [x] `import/no-cycle` on for all packages.
- [x] `pnpm lint` passes; a deliberate bad import in a scratch file fails it (shown in the PR).
