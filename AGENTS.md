# AGENTS.md

Guide for AI agents working in this repo. Keep it current and keep it at
**150 lines or fewer**. Update the "App state" section whenever you add,
remove or rename a package, command or feature.

## What this is

Flows is a local-only web app for building and running workflows of tasks.
A task runs a command, a script or an AI agent CLI as its own process. The
designs live in `docs/designs/`; start at `docs/INDEX.md`.

## App state

Built:

- `apps/web`: Vite 8, React 19, Tailwind 4, shadcn (Base UI, style
  `base-nova`). Shows server health from `/api/health`. Dev on
  `127.0.0.1:5173`, proxies `/api` (HTTP and websocket) to the server.
- `apps/server`: Hono on `@hono/node-server`, run with `tsx` (no build
  step). Listens on `127.0.0.1:8787`. Routes: `GET /api/health`,
  `GET /api/ws` (sends `{"type":"hello"}` on open). `src/app.ts` exports
  `app` and `AppType` for the typed `hc` client.
- `packages/ui`: shared shadcn components and `globals.css`.
- `packages/shared`: zod schemas and types shared by server and web
  (`healthSchema`, `Health`).
- `apps/e2e`: Playwright tests that start server and web together.

Not built yet:

- `packages/engine` (event log, task state machine, scheduler). Next step.
- Workflow and task API routes, YAML files, the visual editor, persistence.

## Commands

Run from the repo root. Package manager is pnpm (see `packageManager`).

```sh
pnpm install
pnpm dev            # server and web (turbo)
pnpm build          # typecheck and build web
pnpm typecheck
pnpm lint           # eslint in every package
pnpm lint:fix
pnpm format         # prettier --write .
pnpm format:check
pnpm test           # vitest unit tests
pnpm test:e2e       # playwright, records video and screenshots
```

One package: `pnpm --filter server test`. In zsh, quote specifiers such as
`"eslint@^10"`.

Playwright artifacts go to `apps/e2e/test-results` (video, screenshot) and
`apps/e2e/playwright-report`. Set `PW_VIDEO=retain-on-failure` or
`PW_SCREENSHOT=only-on-failure` to record less. Install the browser once
with `pnpm --filter e2e exec playwright install chromium`.

## Done means

Before calling work done, run `pnpm lint`, `pnpm typecheck`, `pnpm test`
and, for UI or API changes, `pnpm test:e2e`. All must pass.

## Conventions

- `develop` is the primary branch. Branch from it, target PRs at it. Never
  push or merge to `main` without explicit approval for that change.
- Local only: bind servers to `127.0.0.1`, never `0.0.0.0`.
- KISS and YAGNI. Build what the current step needs, nothing speculative.
- TypeScript strict everywhere, ESM, zod for validation at boundaries.
- Put types shared by server and web in `packages/shared`.
- UI: use shadcn components and AI Elements patterns before custom UI.
  See `.cursor/rules/web.mdc`.
- UI PRs include Playwright videos and screenshots as evidence.
- Do not put any person's name in code, docs or metadata.
- Never commit secrets or `.env` files.

## Tooling for agents

- `.cursor/hooks.json` runs `.cursor/hooks/format.sh` after each agent file
  edit: prettier, then eslint `--fix` with the nearest package config. It
  never blocks the agent.
- `.cursor/rules/*.mdc` hold project rules: `general` (always), `server`,
  `web`, `testing`, `engine` (scoped by globs).

## Pointers

- Docs: `docs/INDEX.md` (designs, backlogs, schema in `docs/README.md`)
- Rules: `.cursor/rules/`
- Human overview: `README.md`
