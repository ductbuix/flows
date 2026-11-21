---
id: BL-056
title: Port leases and per-workflow caches
type: backlog
status: done
summary: Each attempt gets a leased port block in env, package caches go to <workflow>/.cache, and the watcher skips runs and caches.
tags: [engine, sandbox, process, ports]
related: [DES-026, DES-006]
updated: 2026-11-22
priority: P1
depends: []
---

# Port leases and per-workflow caches

Design: [DES-026](../designs/des-026-work-items-library-connections.md)
(Work copies). Repo copies have their own files, but servers and
tests can still clash on ports, and installs write to global caches
that the sandbox blocks. This helps any command task, so it does not
wait for connectors. The per-connection `serial` lock is in BL-048.

## Done when

- [x] The engine leases a block of free ports per attempt and sets
      `PORT`, `FLOWS_PORT_BASE` and `FLOWS_PORT_COUNT` (default 10).
      A block is free when no live attempt holds it and a bind check
      succeeds. It is released when the attempt ends and after resume.
- [x] The lease is recorded on `attempt_launched` and shown in the
      attempt's Environment tab.
- [x] Tasks get `npm_config_cache`, `PNPM_STORE_DIR`, `YARN_CACHE_FOLDER`,
      `XDG_CACHE_HOME` and `PIP_CACHE_DIR` under `<workflow>/.cache/`,
      which the sandbox already allows. A task's own env overrides them.
- [x] The workflow file watcher no longer watches `runs/` or `.cache/`
      (it watches `workflow.yaml` and `memory/` only), and workflow
      export or copy skips `.cache/`.
- [x] Tests cover two parallel attempts getting disjoint blocks, release
      on finish and on resume, and `pnpm install` succeeding in a
      sandboxed task.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
