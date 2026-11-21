---
id: BL-048
title: Propose access and work copies
type: backlog
status: done
summary: access propose gives tasks one work copy per run and connection, a shared clone for repos, a serial lock, and an on-demand change set diff.
tags: [engine, connections, change-sets, effects]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-043, BL-056]
---

# Propose access and work copies

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Work copies, Change sets and conflicts). Nothing leaves
the machine; publish tasks are BL-049.

## Done when

- [x] The first `propose` task on a connection makes
      `runs/<runId>/work/<connectionId>/<kind>/<entityId>/` from the pins;
      later `propose` tasks on it reuse it. `RESOURCE_<ID>` points
      there for `propose` tasks.
- [x] Repos use `git clone --shared` from the library clone at the
      pinned commit; the library clone has `gc.auto=0`. Other sources
      use `cp -cR`, falling back to a plain copy. No git worktree.
- [x] Two `propose` tasks on one connection not ordered by `needs`
      fail validation with a field error.
- [x] `connection.yaml` accepts `serial: true`: its `propose` tasks
      run one at a time across runs, and a waiting task shows why.
- [x] `GET /runs/:runId/changes/:connectionId` returns the change set
      envelope and `preview.md` built by the connector's `diff`. At
      run end, a work copy with unpublished changes records a Local
      effect with its diff.
- [x] Preflight stops warning on `propose`. Deleting a run removes its
      work copies.
- [x] Tests use the fake connector: shared copy, ordering error, serial
      lock, diff, empty diff, destructive flag, and `git commit` inside
      a sandboxed repo copy.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
