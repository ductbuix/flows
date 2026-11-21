---
id: BL-045
title: Connections, Library and connection pages
type: backlog
status: done
summary: Connections page with explainer and Table, a Library tab with revisions and freshness, a connection page, and expired sign-ins in Needs you.
tags: [ui, web, connections, library]
related: [DES-025, DES-026]
updated: 2026-11-22
priority: P1
depends: [BL-034, BL-035, BL-042, BL-043]
---

# Connections, Library and connection pages

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (J7, J10, Pages: Connections, Connection). The
publish policy Select is read-only text here; BL-051 makes it
editable.

## Done when

- [x] Sidebar Platform group gets "Connections". `/connections` has
      `Tabs variant="line"` (Connections, Library) driven by `tab`.
- [x] Connections tab: the three-step explainer (connect, pull,
      publish), a Table (name, connector, sign-in status, refresh
      rule, used by), and an Add connection Dialog built from `GET
/connectors`.
- [x] Library tab: entities with revisions, Freshness Badge (secondary
      Fresh, outline Stale), pinned by runs, and Pull now.
- [x] `/connections/:id`: sign-in (status, Check again), local data,
      used by (workflows, runs), refresh rule Select, policy shown as
      a Badge.
- [x] Impact Badge (secondary Read, outline Local, default Cloud) and
      Freshness Badge join `/dev/kit`.
- [x] Home Needs you lists connections whose `check` fails. e2e covers
      J7 up to sign-in with the fake connector. Screenshots in light
      and dark.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
