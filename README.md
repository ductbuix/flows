# Flows

Local app for building and running workflows of tasks (commands, scripts, AI agent CLIs). See `docs/design.md`.

## Layout

- `apps/web`: Vite + React + shadcn UI (port 5173, proxies `/api` to the server)
- `apps/server`: Hono API and websocket on `127.0.0.1:8787`
- `packages/ui`: shared shadcn components
- `packages/shared`: zod schemas and types shared by server and web

## Commands

```sh
pnpm install
pnpm dev        # server and web together (turbo)
pnpm build      # typecheck and build web
pnpm typecheck
```

Add a UI component: `pnpm dlx shadcn@latest add <name> -c apps/web`.
