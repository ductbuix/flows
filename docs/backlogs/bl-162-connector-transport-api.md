---
id: BL-162
title: Connector API transport
type: backlog
status: done
summary: HTTP transport using cookies or a token from SecretStore.
tags: [connectors, adapters]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-161, BL-129]
---

# Connector API transport

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/adapters-node.

Rally, Confluence and Jenkins style connectors.

## Done when

- [x] Auth header or cookie jar from SecretStore; 401 marks the connector `expired`.
- [x] Tests against a local HTTP stub.
