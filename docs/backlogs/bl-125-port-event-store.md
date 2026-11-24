---
id: BL-125
title: EventStore port, fake and adapter
type: backlog
status: done
summary: EventStore port in core with an in-memory fake, one contract suite, and the Node adapter in adapters-node passing it.
tags: [core, ports, adapters]
related: [DES-041, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-113]
---

# EventStore port, fake and adapter

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/ports, packages/adapters-node.

Move the SQLite event log behind the `EventStore` port (DES-041 Ports). Callers in `packages/engine` switch to the adapter through the port; behaviour does not change.

## Done when

- [x] `EventStore` interface: `append(runId, events, { expectSeq })`, `read(runId, fromSeq)`, `tail()`.
- [x] In-memory fake in `core/src/testing/` and a contract suite run with `describe.each` against fake and adapter.
- [x] the SQLite event log lives in `packages/adapters-node` and passes the suite.
