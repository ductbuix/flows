---
id: BL-166
title: Engine side of the MCP gateway
type: backlog
status: done
summary: Engine listens on the gateway socket, runs each tool call through the permission chain and ConnectorRuntime, and logs it as a run event.
tags: [mcp, connectors, security]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-165, BL-144, BL-161]
---

# Engine side of the MCP gateway

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core, apps/server.

Connect gateway calls to policy and connectors with an audit trail.

## Done when

- [x] One socket per step, removed when the step ends; unknown step token is refused.
- [x] Every call appends `connector_called` with capability and result status.
- [x] Integration test: gateway to stub connector, denied write capability returns an error.
