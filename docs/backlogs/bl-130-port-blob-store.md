---
id: BL-130
title: BlobStore port, fake and adapter
type: backlog
status: done
summary: BlobStore port in core with an in-memory fake, one contract suite, and the Node adapter in adapters-node passing it.
tags: [core, ports, adapters]
related: [DES-041, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-113, BL-118]
---

# BlobStore port, fake and adapter

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/ports, packages/adapters-node.

Move file streaming for assets and run files behind the `BlobStore` port (DES-041 Ports). Callers in `packages/engine` switch to the adapter through the port; behaviour does not change.

## Done when

- [x] `BlobStore` interface: `put(scope, stream) -> BlobRef`, `open(id) -> stream`, scoped opaque ids.
- [x] In-memory fake in `core/src/testing/` and a contract suite run with `describe.each` against fake and adapter.
- [x] file streaming for assets and run files lives in `packages/adapters-node` and passes the suite.
- [x] Daemon serves `GET/PUT /blobs` with the lock token (DES-040 Blobs).
