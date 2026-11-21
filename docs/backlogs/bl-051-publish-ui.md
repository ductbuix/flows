---
id: BL-051
title: Publish task in the editor, changes to publish and effects ledger
type: backlog
status: todo
summary: Add a publish node in the editor, review a waiting publish with a diff, see unpublished changes and the effects ledger, and set the policy.
tags: [ui, web, connections, safety, editor]
related: [DES-025, DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-046, BL-049]
---

# Publish task in the editor, changes to publish and effects ledger

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (J9, J11, Pages: Editor, Run view, Connection, Resolved
questions).

## Done when

- [ ] The editor adds a publish task from the canvas: a connection
      Select (only connections with a `propose` task before it) and
      the usual name and needs. Nodes show a Cloud impact Badge. The
      Inspector enables Propose changes.
- [ ] Run view: a waiting publish task shows "Changes to publish" with
      the impact Badge, a warning naming destructive ops,
      `preview.md`, a Code Block diff, and Discard (Reject) and
      Publish (Approve).
- [ ] A conflict shows an Alert with "Rerun with fresh pull". Unpublished
      local changes show per connection with their diff.
- [ ] Effects Table on the run: what, connection, impact Badge, result,
      undo note.
- [ ] Home Needs you shows waiting publish tasks with their connection.
- [ ] The connection page's policy is a Select with a
      `FieldDescription` per option. Policy Badge joins `/dev/kit`.
- [ ] e2e covers J9 and a conflict with the fake connector. Screenshots
      in light and dark.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
