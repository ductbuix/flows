# Flows

Local app for building and running workflows of tasks (commands, scripts, AI agent CLIs). Docs: start at `docs/INDEX.md`.

## Layout

- `apps/web`: Vite + React + shadcn UI (port 5173, proxies `/api` to the server)
- `apps/server`: Hono API and websocket on `127.0.0.1:8787`
- `packages/ui`: shared shadcn components
- `packages/contracts`: zod schemas and types shared by server and web
- `apps/e2e`: Playwright end to end tests (starts server and web)

## Commands

```sh
pnpm install
pnpm dev          # server and web together (turbo)
pnpm build        # typecheck and build web
pnpm typecheck
pnpm lint         # pnpm lint:fix to fix
pnpm format       # pnpm format:check to check
pnpm test         # vitest unit tests
pnpm test:e2e     # playwright, records video and screenshots
```

Agent guide: `AGENTS.md`. Cursor rules: `.cursor/rules`.

Add a UI component: `pnpm dlx shadcn@latest add <name> -c apps/web`.
