---
id: BL-051
title: Changes to publish, diff preview and effects ledger
type: backlog
status: todo
summary: Run view Changes to publish with a Code Block diff, conflict Alert and effects ledger, pending publishes on Home, and the policy Select.
tags: [ui, web, connections, safety]
related: [DES-025, DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-046, BL-049]
---

# Changes to publish, diff preview and effects ledger

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (J9, J11, Pages: Run view, Connection, Resolved
questions: conflict states).

## Done when

- [ ] Run view: "Changes to publish" per connection with impact Badge,
      a warning, `preview.md`, a Code Block diff, and Discard and
      Publish. Destructive ops are named in the warning.
- [ ] A conflict is an Alert with two actions: pull again and rerun,
      or discard.
- [ ] Effects Table on the run: what, connection, impact Badge,
      result, undo note.
- [ ] Home Needs you lists pending publishes.
- [ ] The connection page's policy is a Select with a
      `FieldDescription` per option. The Inspector enables Propose
      changes.
- [ ] Policy Badge joins `/dev/kit`. e2e covers J9 and a conflict with
      the fake connector. Screenshots in light and dark.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
