---
id: BL-214
title: "Move remaining engine modules to core and adapters"
type: backlog
status: done
summary: Settings, MCP trust, secrets, sandbox, library and publish code move out of packages/engine.
tags: [engine, core, adapters]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-197, BL-210]
---

# Move remaining engine modules to core and adapters

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/engine.

Hosts import `createEngine` and leftovers from `@workspace/adapters-node`
(`src/host/`). `packages/engine` remains until BL-215 deletes it.

Skipped (parallel BL-213): work-item modules. Connection store still
lives under `adapters-node/host` with a TODO for BL-213.

Restored: Asset `access: propose` work copies (`ensureWorkCopiesFor` on
run start; `RESOURCE_*` → `work/` for command steps).

## Done when

- [x] `@workspace/engine` has no importer.
- [x] Moved tests pass.
