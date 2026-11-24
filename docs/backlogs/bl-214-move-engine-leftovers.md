---
id: BL-214
title: "Move remaining engine modules to core and adapters"
type: backlog
status: todo
summary: Settings, MCP trust, secrets, sandbox, library and publish code move out of packages/engine.
tags: [engine, core, adapters]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-197, BL-210]
---

# Move remaining engine modules to core and adapters

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/engine.

List what is still imported from `@workspace/engine` and move each module behind a core port or into `adapters-node`.

## Done when

- [ ] `@workspace/engine` has no importer.
- [ ] Moved tests pass.
