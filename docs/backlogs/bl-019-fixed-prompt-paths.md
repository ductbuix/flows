---
id: BL-019
title: Fixed prompt paths and generated task ids
type: backlog
status: todo
summary: Derive prompt paths from the task id, generate ids, accept spawn specs by file stem, and reject leftover instructions keys.
tags: [engine, schema, agents, files]
related: [DES-020, DES-002, DES-004, DES-005]
updated: 2026-11-21
priority: P0
depends: []
---

# Fixed prompt paths and generated task ids

Design: [DES-020](../designs/des-020-fixed-prompt-files.md).

## Done when

- [ ] Shared helpers `newTaskId`, `taskPromptPath`, `judgePromptPath`
      and `upstreamEnvName` exist in `packages/shared`. Agent, command
      and judge schemas have no `instructions` field. A leftover key
      is a clear parse error that names the target path when it can
      be derived.
- [ ] New ids use `task-` plus eight hex characters, with a retry on
      collision. Legacy single-segment ids still parse. Optional
      `name` is accepted on every task. Two tasks that would map to
      the same `UPSTREAM_*` name are a parse error.
- [ ] At most one agent judge per slot, including inside `all` / `any`;
      a second one is a schema error. Unsafe path-segment ids are
      rejected.
- [ ] The engine derives the prompt from the task id or from a stamped
      `promptDir`. A missing authored `prompt.md` fails the attempt with
      reason `missing_prompt`. Spawn specs have no `id`; they are
      identified by file stem, get a generated id, and have `needs`
      rewritten from stems to ids. Promote copies the folder and
      strips the stamp.
- [ ] `UPSTREAM_*` env names use `upstreamEnvName`. A pre-run check
      warns when an authored prompt or judge file is missing. Kind
      switch to agent no longer writes `instructions`.
- [ ] Unit tests cover parse errors, id generation, stem resolution,
      spawn and promote, `missing_prompt`, env name mapping, and the
      pre-run warning.
- [ ] Fixtures and engine tests no longer use an `instructions` key
      or an `id` on a spawn spec.
