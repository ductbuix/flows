---
id: BL-113
title: packages/core skeleton and kernel
type: backlog
status: done
summary: "New packages/core with kernel types (EngineError, Result, Clock, Ids, Logger) and a lint rule that forbids node: imports inside core."
tags: [core, engine]
related: [DES-041, DES-042]
updated: 2026-11-24
priority: P0
depends: []
---

# packages/core skeleton and kernel

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core (new).

Start the UI-free core next to today's `packages/engine`. Only the kernel lands here; nothing is moved yet.

## Done when

- [x] `packages/core/src/kernel/` exports `EngineError` (code from the error enum or a string for now), `Result`, `Clock`, `Ids`, `Logger` interfaces and test fakes in `core/src/testing/`.
- [x] ESLint `no-restricted-imports` in `packages/core/**` bans `node:*`, `fs`, `child_process`, `better-sqlite3`.
- [x] Unit tests for `Result` helpers and the fake clock.
