---
id: BL-128
title: ProcessRunner port, fake and adapter
type: backlog
status: done
summary: ProcessRunner port in core with an in-memory fake, one contract suite, and the Node adapter in adapters-node passing it.
tags: [core, ports, adapters]
related: [DES-041, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-113]
---

# ProcessRunner port, fake and adapter

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/ports, packages/adapters-node.

Move `runner.ts`, `pid.ts` and `sandbox.ts` behind the `ProcessRunner` port (DES-041 Ports). Callers in `packages/engine` switch to the adapter through the port; behaviour does not change.

## Done when

- [x] `ProcessRunner` interface: `spawn(spec, signal) -> { stdin, stdout, stderr, exit }` in its own process group, sandbox profile in the spec.
- [x] In-memory fake in `core/src/testing/` and a contract suite run with `describe.each` against fake and adapter.
- [x] `runner.ts`, `pid.ts` and `sandbox.ts` lives in `packages/adapters-node` and passes the suite.
