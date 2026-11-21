---
id: BL-056
title: Port leases, repo lock and per-workflow caches
type: backlog
status: todo
summary: Each attempt gets a leased port block in env, a connection can run one task at a time, and package caches go to <workflow>/.cache.
tags: [engine, sandbox, process, ports]
related: [DES-026, DES-006]
updated: 2026-11-22
priority: P1
depends: []
---

# Port leases, repo lock and per-workflow caches

Design: [DES-026](../designs/des-026-work-items-library-connections.md)
(Work copies). Repo copies have their own files, but servers and
tests can still clash on ports, and installs write to global caches
that the sandbox blocks. The lease and caches help any command task,
so this item does not wait for connectors; the lock needs BL-042.

## Done when

- [ ] The engine leases a block of free ports per attempt and sets
      `PORT`, `FLOWS_PORT_BASE` and `FLOWS_PORT_COUNT` (default 10).
      A block is free when no live attempt holds it and a bind check
      succeeds. It is released when the attempt ends and after resume.
- [ ] The lease is recorded on `attempt_launched` and shown in the
      attempt's Environment tab.
- [ ] Tasks get `npm_config_cache`, `PNPM_STORE_DIR`, `YARN_CACHE_FOLDER`,
      `XDG_CACHE_HOME` and `PIP_CACHE_DIR` under `<workflow>/.cache/`,
      which the sandbox already allows. A task's own env overrides them.
- [ ] Once BL-042 lands, `connection.yaml` accepts `serial: true`: tasks
      that use that connection with `propose` run one at a time across
      runs, and a waiting task shows why.
- [ ] Tests cover two parallel attempts getting disjoint blocks, release
      on finish and on resume, and `pnpm install` succeeding in a
      sandboxed task.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
