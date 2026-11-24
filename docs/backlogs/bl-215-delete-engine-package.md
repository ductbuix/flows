---
id: BL-215
title: "Delete packages/engine"
type: backlog
status: done
summary: Remove the package, its docs references and its lint config.
tags: [engine, cleanup]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-213, BL-214]
---

# Delete packages/engine

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/engine.

Delete the package and update AGENTS.md, DES-015 and DES-039. Host facade is
`createHost` / `Host` in `packages/adapters-node/src/host`. Node `connection`
fields resolve through v2 `connectors/<id>.yaml`.

## Done when

- [x] `packages/engine` does not exist.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.
