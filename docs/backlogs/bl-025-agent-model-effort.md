---
id: BL-025
title: Agent model and effort in the schema, adapters, and attempts
type: backlog
status: done
summary: Optional model and effort on tasks, judges, and per-CLI workflow defaults, with flags, listing, preflight warnings, and attempt records.
tags: [engine, server, agents, yaml]
related: [DES-023, DES-005, DES-019, DES-020]
updated: 2026-11-21
priority: P0
depends: []
---

# Agent model and effort in the schema, adapters, and attempts

Design: [DES-023](../designs/des-023-model-effort.md).

## Done when

- [x] Agent tasks, agent judges, and `workflow.agent.<cli>` accept
      optional `model` (non-empty string) and `effort` (`low`,
      `medium`, `high`, `xhigh`, `max`). A shared helper resolves
      judge, then same-cli parent task, then workflow, then omit
      flags.
- [x] `CliAdapter` has `readDefaults`, `listModels`, and
      `composeFlags`. Claude adds `--model` and `--effort`. Cursor
      adds one `--model` with the composed family id. Settings
      files are read and never written. Cursor `modelId: default`
      is `auto`.
- [x] Cursor `listModels` parses `agent --list-models` into
      families and supported efforts, unit-tested with a fixture.
      Composition prefers the non-fast id. The judge cache key
      includes the resolved model and effort.
- [x] Preflight warns, and does not block, when a resolved model
      is unknown or an effort is not offered for that model. It
      also lists the resolved pair for each agent task and judge.
- [x] `attempt_launched` records `model`, `effort`, and
      `modelSource` (`task`, `workflow`, or `cli`).
- [x] `GET /api/cli/:cli/models` returns the catalog, cached for
      60 seconds. A listing failure still returns the Default
      option and an error message.
- [x] Tests cover resolution, flag composition (including Cursor
      families and a custom bracket id), omitted flags, cache
      keys, preflight warnings, and the API.
