---
id: BL-165
title: Flows MCP gateway server
type: backlog
status: done
summary: "packages/mcp-gateway: a stdio MCP server that lists given tools and forwards each call to the engine over a private socket."
tags: [mcp, agents, security]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: []
---

# Flows MCP gateway server

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/mcp-gateway (new).

The agent's only door to connectors. This item is the server half only, tested on its own.

## Done when

- [x] Tools come from a JSON spec passed at launch; calls forward to a socket path and return its result.
- [x] No credentials or connector code in this package.
- [x] Test with an MCP client fixture and a stub socket.
