---
id: BL-218
title: "Remove legacy node options from canvas polish"
type: backlog
status: todo
summary: Drop the agent node kind and the folder and publish output modes once no saved workflow uses them.
tags: [engine, canvas]
related: [DES-016, DES-034, DES-040]
updated: 2026-11-25
priority: P2
depends: []
---

# Remove legacy node options from canvas polish

## Why

The 2026-11-24 canvas polish (DES-016 decision log) hid two options from the
canvas but kept them loadable so older workflows still run. Add node offers
LLM, not Agent. Notify output offers `channel: app | system` only. Keeping
the legacy paths means two code paths to maintain for no current user.

Legacy paths left on this branch:

- `agent` node kind: still registered in `packages/core/src/nodes/kinds/agent.ts`.
- Output `folder` and `publish` targets: still accepted in
  `packages/contracts/src/nodes/output.ts`.

## What

- Remove the `agent` node kind registration and its runner path.
- Remove the `folder` and `publish` output modes from the contract and from
  the engine output code.
- Give old workflow files a clear result: either migrate them on load
  (`agent` to `llm`, `folder`/`publish` to `notify`), or reject them with a
  load-time error that names the node or output and the file.
- Update `packages/contracts` schema tests and any e2e fixtures that still
  use the legacy options.

## Revisit when

No saved workflow under FLOWAPP_HOME or fixtures uses `kind: agent` or output `folder`/`publish`.

## Done when

- [ ] A search of FLOWAPP_HOME defaults and `apps/e2e` fixtures finds no `kind: agent` and no output `folder` or `publish`.
- [ ] `agent` is no longer registered in `packages/core/src/nodes/kinds/`.
- [ ] `packages/contracts/src/nodes/output.ts` accepts only `notify` with `channel: app | system`.
- [ ] Old workflow files either migrate on load or fail with a named load-time error (covered by a test).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.
- [ ] DES-016 decision log has a new row recording the removal.
