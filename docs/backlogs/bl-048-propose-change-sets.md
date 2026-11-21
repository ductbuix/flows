---
id: BL-048
title: Propose access, work copies and change sets
type: backlog
status: todo
summary: "access: propose gives a task a work copy under the run; after the task, Flows writes changeset.json and preview.md and records effects."
tags: [engine, connections, change-sets, effects]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-043]
---

# Propose access, work copies and change sets

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Folder layout, Change sets and conflicts, Safety:
impact). Nothing leaves the machine yet; publishing is BL-049.

## Done when

- [ ] With `access: propose`, the task's `RESOURCE_<ID>` points at
      `runs/<runId>/work/<connectionId>/`, a copy of the pinned
      revision (a git worktree for repo connectors). It is inside the
      workflow dir, so the sandbox allows writes.
- [ ] After the task succeeds, the connector's `diff` writes
      `changes/<connectionId>/changeset.json` (the envelope in
      DES-026) and `preview.md`. An empty diff writes nothing.
- [ ] `effect_recorded` events record Read (pull), Local (change set)
      with an undo note. `GET /runs/:runId/effects` returns the ledger
      derived from events.
- [ ] Preflight stops warning on `propose`.
- [ ] Tests use the fake connector: work copy, diff, empty diff,
      destructive op flag, ledger after restart.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
