---
id: BL-071
title: "Connections, Library, Connection page and Settings"
type: backlog
status: blocked
summary: Header actions at 32px, Library rows that never wrap, Card grids on the Connection page and Settings, CLI trust in Settings.
tags: [ui, web, connections, settings]
related: [DES-029]
updated: 2026-11-22
priority: P2
depends: [BL-058, BL-059]
---

# Connections, Library, Connection page and Settings

Retired on 2026-11-22 before the node workflow build. The status is `blocked` because the docs schema has no retired status; this file stays as history.

Design: [DES-029](../designs/des-029-ui-renovation-run-screens.md)
(Connections and Library, Connection page, Settings). Fixes #37 to #41.

## Done when

- [ ] Add connection is a 32px header action; the explainer shows inside
      the empty state, and as a "How it works" link otherwise.
- [ ] Library rows are 37px; revisions are `IdText` with a `HoverCard`.
- [ ] Connection page and Settings use
      `grid grid-cols-1 gap-4 @3xl/main:grid-cols-2` of Cards (560px
      each) with actions in `CardFooter`.
- [ ] Settings has Appearance, Agent CLIs (Allow or Revoke per CLI),
      Allowed MCP servers and Keyboard shortcuts.
