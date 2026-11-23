---
id: BL-163
title: Connector MCP transport
type: backlog
status: todo
summary: MCP client transport for connectors that are MCP servers (command or URL).
tags: [connectors, mcp]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-161]
---

# Connector MCP transport

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/adapters-node.

Reuse MCP servers the user already has.

## Done when

- [ ] Lists tools as capabilities on check; calls go through the same capability gate.
- [ ] Test with a tiny stdio MCP server fixture.
