---
id: BL-126
title: DocumentStore port, fake and adapter
type: backlog
status: todo
summary: DocumentStore port in core with an in-memory fake, one contract suite, and the Node adapter in adapters-node passing it.
tags: [core, ports, adapters]
related: [DES-041, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-113]
---

# DocumentStore port, fake and adapter

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/ports, packages/adapters-node.

Move file reads and hash-checked writes behind the `DocumentStore` port (DES-041 Ports). Callers in `packages/engine` switch to the adapter through the port; behaviour does not change.

## Done when

- [ ] `DocumentStore` interface: `read -> { text, hash }`, `write(path, text, { baseHash })` with `conflict`, `list(glob)`, `remove`; atomic writes.
- [ ] In-memory fake in `core/src/testing/` and a contract suite run with `describe.each` against fake and adapter.
- [ ] file reads and hash-checked writes lives in `packages/adapters-node` and passes the suite.
