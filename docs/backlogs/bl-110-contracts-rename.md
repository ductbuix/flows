---
id: BL-110
title: Rename shared to contracts
type: backlog
status: todo
summary: packages/shared becomes packages/contracts; a re-export shim keeps @workspace/shared imports working until callers move.
tags: [contracts, packages]
related: [DES-039]
updated: 2026-11-24
priority: P0
depends: []
---

# Rename shared to contracts

Design: [DES-039](../designs/des-039-system-architecture-v2.md). Layer: packages/shared, packages/contracts.

Rename the package that holds zod schemas so its name says what it is (DES-039). Keep a thin `@workspace/shared` that re-exports everything, so no caller changes in this item.

## Done when

- [ ] `packages/contracts` (`@workspace/contracts`) holds the code; `packages/shared` only re-exports it.
- [ ] AGENTS.md layout updated.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm lint` pass with no other source change.
