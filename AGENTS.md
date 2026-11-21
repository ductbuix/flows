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

- `apps/web`: Vite 8, React 19, Tailwind 4, shadcn (Base UI, `base-nova`)
  on `127.0.0.1:5173`, proxies `/api`. Sidebar Platform (Home, Work
  items, Workflows, Runs), Workflows group, Settings; `/work-items`
  and `/work-items/:id`; `/connections` and `/connections/:id`
  (browser sign-in / remove); `/workflows` and `/runs`; graph editor,
  start/rerun, run view with live websocket; Settings.
- `apps/server`: Hono + `tsx` on `127.0.0.1:8787`. Health, workflows,
  memory, files, promote, trust, CLI models, connections
  CRUD/check/sign-in and `GET /connectors`, library GET/pull, work
  items, run REST (workItemId, refreshPins), websockets.
- `packages/engine`: SQLite event log + settings, fold, scheduler,
  command/agent tasks, connector registry (github read, fake for
  tests), connections, cookie secrets under `secrets/` (Chrome
  sign-in, sandbox denies reads), library revisions/pull/pins
  (`resources/` + `RESOURCE_*`), work items, preflight, trust markers,
  spawn, resume, approval, ports/caches.
- `packages/shared`: zod schemas for API (`runSummarySchema` with
  `needsYou`/`workItemId`, `workItemSchema`), websocket, workflow,
  `connection.yaml`, library list/pull and `resources.json`, events
  (`queued`, `run_activated`, `library_pulled`, `workItemId`) and YAML
  Document edits.
- `packages/ui`: shared shadcn components and `globals.css`.
- `apps/e2e`: Playwright against a temp `FLOWAPP_HOME`.
- `packages/docs-tools`: docs index generator and checker.
- `docs/`: designs (`DES-*`) and backlogs (`BL-*`) with generated indexes.

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
