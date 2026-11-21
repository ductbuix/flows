---
id: BL-043
title: Library store, pull on demand and run pins
type: backlog
status: todo
summary: library/<connection>/<kind>/<entity>/<revision> with current, pull on run start by refresh rule, resources.json pins and RESOURCE_<ID>.
tags: [engine, library, runs, sandbox]
related: [DES-026, DES-006]
updated: 2026-11-22
priority: P1
depends: [BL-042]
---

# Library store, pull on demand and run pins

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Pulling, Safety). Read access only; `propose`
overlays are BL-048. Retention is BL-047.

## Done when

- [ ] `packages/engine/src/library.ts` writes immutable revisions and
      moves the `current` link atomically. A refresh adds a revision
      and never edits one.
- [ ] Starting a run resolves the work item's links and every task's
      `uses`, pulls what is missing or older than the refresh rule,
      and writes `runs/<runId>/resources.json` (connection, entity,
      revision) before `run_started`.
- [ ] A failed or signed-out pull fails the start with a clear error
      unless a pinned or current revision exists, in which case the
      run starts with a warning.
- [ ] Tasks get `RESOURCE_<ID>` (connection id, upper snake case)
      pointing at the pinned revision. A rerun uses the same pins.
- [ ] `POST /library/pull` (connection, entity) pulls now; `GET
    /library` lists entities, revisions, freshness and pinning runs.
- [ ] A sandbox test shows a task cannot write under `library/`;
      `library_pulled` events record each pull.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
