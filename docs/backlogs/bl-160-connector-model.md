---
id: BL-160
title: Connector files and CRUD
type: backlog
status: done
summary: connectors/<id>.yaml (transport, how, auth kind, capabilities with write flags) and connector/list, get, save, remove, set_capability.
tags: [connectors, fcp]
related: [DES-041, DES-040]
updated: 2026-11-24
priority: P1
depends: [BL-126, BL-115]
---

# Connector files and CRUD

Design: [DES-041](../designs/des-041-engine-core.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: packages/contracts, packages/core/connectors.

Back the Connectors mockup's model: transport x auth x capabilities. Secrets never in the file.

## Done when

- [x] Schema allows only the transport and auth pairs of the mockup (`AUTH_FOR`).
- [x] Write capabilities default off.
- [x] Protocol tests; a secret value in the YAML is rejected.
