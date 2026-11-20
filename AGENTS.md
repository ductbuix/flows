# AGENTS.md

Keep this file under **100 lines**. Update the layout when you add, remove
or rename a package, command or feature.

## What this is

Flows is a local-only web app for building and running workflows of tasks.
A task runs a command, a script or an AI agent CLI as its own process.

## Direction

Start at `docs/INDEX.md`. Vision, architecture, decision log and roadmap
are DES-014 to DES-017. Add a row to DES-016 when a decision lands.
Find a doc from the index, then a section index; never read whole folders.
Schema and writing rules: `docs/README.md`.

## Layout

- `apps/web`: Vite 8, React 19, Tailwind 4, shadcn (Base UI, `base-nova`).
  Dev on `127.0.0.1:5173`, proxies `/api` to the server.
- `apps/server`: Hono + `tsx` on `127.0.0.1:8787`. Health, workflow/run
  REST, log/summary/out, websocket run snapshots and log chunks.
- `packages/engine`: SQLite event log, fold, scheduler, command and agent
  tasks (Claude Code / Cursor CLI), spawn into `graph.json`, resume,
  approval, cancel, conditions (exit / expr / agent judge), retry,
  repeat, `agents` limits.
- `packages/shared`: zod schemas for API, websocket, workflow and events.
- `packages/ui`: shared shadcn components and `globals.css`.
- `apps/web`: workflow list, run list, run view (list/graph, attempts,
  logs, SUMMARY.md) with live websocket updates.
- `apps/e2e`: Playwright against a temp `FLOWAPP_HOME`.
- `packages/docs-tools`: docs index generator and checker.
- `docs/`: designs (`DES-*`) and backlogs (`BL-*`) with generated indexes.

Not built yet: run controls (BL-012), visual editor (BL-009).

## Commands

Run from the repo root with pnpm:

```sh
pnpm install
pnpm dev            # server and web
pnpm build          # typecheck and build web
pnpm typecheck
pnpm lint           # eslint, then docs:check
pnpm lint:fix
pnpm format
pnpm format:check
pnpm test           # vitest
pnpm test:e2e       # playwright
pnpm docs:index
pnpm docs:check
```

One package: `pnpm --filter server test`. Install the Playwright browser
once with `pnpm --filter e2e exec playwright install chromium`.

## Done means

`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` for UI or
API changes, all pass.

## Conventions

- Branch from `develop`, target PRs at it. Never push or merge to `main`
  without explicit approval.
- Local only: bind servers to `127.0.0.1`, never `0.0.0.0`. macOS only
  for now.
- App data lives under `FLOWAPP_HOME` when set, otherwise `~/.flowapp`.
- Project rules: `.cursor/rules/`.
