---
id: BL-043
title: Library store, pull at run start and run resources
type: backlog
status: todo
summary: Library revisions with current, pull at run start by refresh rule, resources.json pins, and a per-run resources/ folder with RESOURCE_<ID>.
tags: [engine, library, runs, sandbox]
related: [DES-026, DES-006, DES-021]
updated: 2026-11-22
priority: P1
depends: [BL-042]
---

# Library store, pull at run start and run resources

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Folder layout, Resources on disk, Pulling, Safety). Read
access only; work copies are BL-048 and retention is BL-047. Work item
links arrive with BL-046; until then only `uses` and the connection's
own scope entity are pulled.

## Done when

- [ ] `packages/engine/src/library.ts` writes immutable revisions under
      `library/<connectionId>/<kind>/<entityId>/<revision>/` and moves
      `current` atomically. A refresh adds a revision, never edits one.
- [ ] Starting a run, queued or not, pulls what is missing or older than
      the refresh rule and writes `resources.json` before
      `run_started`. Pins are not taken again on activate.
- [ ] A failed or signed-out pull fails the start with a clear error,
      unless a revision already exists; then the run starts with a
      warning and pins it.
- [ ] Each run gets `resources/<connectionId>/<kind>/<entityId>` links
      to the pinned revisions and `resources/index.json`. Every task
      gets `RESOURCES_DIR`; a task with `uses` also gets
      `RESOURCE_<ID>` for that connection. Rerun reuses the pins;
      rerun with `refreshPins: true` pulls and pins again.
- [ ] `POST /library/pull` (connection, entity) pulls now; `GET /library`
      lists entities, revisions, freshness and pinning runs.
      `library_pulled` events record each pull as a Read effect.
- [ ] A sandbox test shows a task can read through `resources/` but
      cannot write under `library/`.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
