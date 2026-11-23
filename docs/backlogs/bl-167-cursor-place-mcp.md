---
id: BL-167
title: Cursor gets the gateway as its MCP server
type: backlog
status: todo
summary: The Cursor profile writes .cursor/mcp.json in the work dir with only the gateway, and checks whether session/new mcpServers is honoured.
tags: [cursor, mcp, acp]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-140, BL-165]
---

# Cursor gets the gateway as its MCP server

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp/profiles.

Resolve the open DES-041 gap and record the answer.

## Done when

- [ ] Gateway entry written for each step; nothing else listed.
- [ ] A manual check against the real CLI is recorded in DES-041 and the `mcpParam` flag set accordingly.
- [ ] Fake agent test sees the file.
