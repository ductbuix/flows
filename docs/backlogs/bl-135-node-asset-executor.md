---
id: BL-135
title: Asset node on the new contract
type: backlog
status: todo
summary: Asset resolves a Library item version or card asset to a file, or writes one from its input, through DocumentStore.
tags: [core, nodes, assets]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-134, BL-126]
---

# Asset node on the new contract

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/nodes.

Port the Asset kind (mockup `asset`: image or markdown) to the executor contract.

## Done when

- [ ] Fixed asset reads the pinned version; produced asset writes to the run outputs.
- [ ] Missing file fails the step with a clear reason.
- [ ] Tests on fakes for both modes.
