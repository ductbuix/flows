---
id: BL-215
title: "Delete packages/engine"
type: backlog
status: todo
summary: Remove the package, its docs references and its lint config.
tags: [engine, cleanup]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-213, BL-214]
---

# Delete packages/engine

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/engine.

Delete the package and update AGENTS.md, DES-015 and DES-039.

## Done when

- [ ] `packages/engine` does not exist.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.
