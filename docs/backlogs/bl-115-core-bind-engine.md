---
id: BL-115
title: "bindEngine: serve a method table on a peer"
type: backlog
status: todo
summary: bindEngine wires FCP method handlers to a peer with zod validation and EngineError to JSON-RPC error mapping.
tags: [core, protocol]
related: [DES-040, DES-041]
updated: 2026-11-24
priority: P0
depends: [BL-105, BL-111, BL-113]
---

# bindEngine: serve a method table on a peer

Design: [DES-040](../designs/des-040-flows-client-protocol.md), [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/rpc.

Make the binding generic: given handlers keyed by method name, it validates params, passes `ctx` (signal, client info), validates results in development and maps errors.

## Done when

- [ ] Invalid params return `invalid_params` with zod issue paths.
- [ ] `EngineError` maps to its code; any other throw maps to `internal` and is logged.
- [ ] Unit tests over linked transports with a two-method sample table.
