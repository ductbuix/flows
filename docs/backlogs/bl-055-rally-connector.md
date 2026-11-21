---
id: BL-055
title: Rally connector via session cookies
type: backlog
status: todo
summary: Rally stories and defects pulled and proposed with stored session cookies, with expiry detected by check.
tags: [engine, connections, rally]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-048, BL-053]
---

# Rally connector via session cookies

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (First source, Sign-in methods, Secrets).

## Done when

- [ ] `describe` lists entity kinds `story` and `defect` with scope
      workspace and project; sign-in method `cookies`, signed in
      through the browser flow of BL-053.
- [ ] `check` detects expired cookies; the UI shows an expired sign-in
      and pulls stop while tasks keep working on pulled data.
- [ ] `pull` writes the item as JSON plus Markdown; `diff` and
      `publish` support a comment and a field change.
- [ ] A work item can be created from a Rally story with the outline
      source Badge.
- [ ] Tests use a stub HTTP server.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
