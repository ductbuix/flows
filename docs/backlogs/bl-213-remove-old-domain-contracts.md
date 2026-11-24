---
id: BL-213
title: "Remove old domain contracts"
type: backlog
status: todo
summary: Delete work-item, connection, attempt-kind and api*.ts schemas that no host uses.
tags: [contracts, cleanup]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-197]
---

# Remove old domain contracts

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/contracts, packages/shared.

Docket replaced work items; connectors replaced connections. Remove the schemas and the `packages/shared` shim.

## Done when

- [ ] `git grep work-item connection` finds no live use.
- [ ] `pnpm typecheck` passes.
