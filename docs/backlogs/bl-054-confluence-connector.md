---
id: BL-054
title: Confluence connector via MCP
type: backlog
status: done
summary: Confluence pages pulled and proposed through an MCP server configured on the connection, proving the MCP sign-in path.
tags: [engine, connections, confluence, mcp]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-049]
---

# Confluence connector via MCP

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (First source, Sign-in methods).

## Done when

- [x] `describe` lists entity kind `page` with scope space key;
      sign-in method `mcp`. The MCP server owns its sign-in; Flows
      stores only its command or URL in `connection.yaml`.
- [x] `pull` writes a page as Markdown plus metadata; the revision is
      the page version.
- [x] `diff` makes a page update op with a unified diff payload;
      `publish` checks the version as base.
- [x] A local MCP server runs only after the user allows it, the same
      trust flow as agent CLIs (BL-018); allowed servers are listed
      in Settings and can be revoked.
- [x] Tests use a stub MCP server.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
