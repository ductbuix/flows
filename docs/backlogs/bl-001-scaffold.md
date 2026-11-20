---
id: BL-001
title: Monorepo scaffold
type: backlog
status: done
summary: Turborepo with shadcn Vite web, Hono server with typed client and websocket, shared zod package.
tags: [scaffold, web, server]
related: [DES-001, DES-008]
updated: 2026-11-20
priority: P0
depends: []
---

# Monorepo scaffold

Done in commit `e1c220e`.

## Scope

- shadcn Vite monorepo (preset `b1HvWXNDFK`): `apps/web`, `packages/ui`.
- `apps/server`: Hono on `@hono/node-server`, `GET /api/health`,
  `GET /api/ws`, bound to `127.0.0.1:8787`.
- `packages/shared`: `healthSchema`. Web calls the server through
  `hc<AppType>`.

## Done when

- [x] `pnpm dev` serves web and server; health shows in the page.
- [x] Health works direct and through the Vite proxy; websocket says hello.
- [x] `pnpm build` passes.
