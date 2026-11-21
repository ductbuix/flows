---
id: BL-054
title: Confluence connector via MCP
type: backlog
status: todo
summary: Confluence pages pulled and proposed through an MCP server configured on the connection, proving the MCP sign-in path.
tags: [engine, connections, confluence, mcp]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-048, BL-053]
---

# Confluence connector via MCP

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (First source, Sign-in methods).

## Done when

- [ ] `describe` lists entity kind `page` with scope space key;
      sign-in method `mcp` with the server command or URL in
      `connection.yaml` and any secret in the Keychain.
- [ ] `pull` writes a page as Markdown plus metadata; the revision is
      the page version.
- [ ] `diff` makes a page update op with a unified diff payload;
      `publish` checks the version as base.
- [ ] Tests use a stub MCP server.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
