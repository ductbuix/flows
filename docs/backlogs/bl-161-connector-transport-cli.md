---
id: BL-161
title: Connector transport registry and CLI transport
type: backlog
status: done
summary: ConnectorTransport registry and the cli transport that runs an allowed capability through ProcessRunner.
tags: [connectors, adapters]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-160, BL-128]
---

# Connector transport registry and CLI transport

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/connectors, packages/adapters-node.

First transport (GitHub through `gh`).

## Done when

- [x] `call(connectorId, capability, args, signal)` refuses capabilities that are off with `policy_denied`.
- [x] Capability to command mapping is data in the connector file.
- [x] Tests with a stub binary.
