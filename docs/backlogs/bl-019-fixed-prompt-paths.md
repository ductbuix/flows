---
id: BL-019
title: Fixed prompt paths in the schema and engine
type: backlog
status: todo
summary: Derive agent and judge prompt paths from the task id, reject leftover instructions keys, and move folders on rename.
tags: [engine, schema, agents, files]
related: [DES-020, DES-002, DES-004, DES-005]
updated: 2026-11-21
priority: P0
depends: []
---

# Fixed prompt paths in the schema and engine

Design: [DES-020](../designs/des-020-fixed-prompt-files.md).

## Done when

- [ ] Shared helpers `taskPromptPath` and `judgePromptPath` exist in
      `packages/shared`. Agent, command and judge schemas have no
      `instructions` field. A leftover key is a clear parse error that
      names the target path when it can be derived.
- [ ] At most one agent judge per slot, including inside `all` / `any`;
      a second one is a schema error. Task ids that are not a single
      path segment are rejected.
- [ ] The engine derives the prompt from the task id or from a stamped
      `promptDir`. A missing authored `prompt.md` fails the attempt with
      reason `missing_prompt`. Spawn validation rejects a missing
      prompt or judge file and stamps `promptDir` on accepted tasks.
      Promote copies the folder and strips the stamp.
- [ ] Workflow PUT accepts `renames`, moves `tasks/<old>/` in the same
      request as the yaml write, and renames `need-<id>` files, with
      the conflict, rollback and idempotent rules in DES-020.
- [ ] A pre-run check warns when an authored prompt or judge file is
      missing. Kind switch to agent no longer writes `instructions`.
- [ ] Unit tests cover parse errors, path helpers, spawn and promote,
      rename moves, `missing_prompt`, and the pre-run warning.
- [ ] Fixtures and engine tests no longer use an `instructions` key.
