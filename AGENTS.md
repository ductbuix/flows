# AGENTS.md

Keep this file under **100 lines**. Update layout when packages or commands change.

## What this is

Flows is a local-only web app for building and running workflows of tasks.
A task runs a command, script or AI agent CLI as its own process.

## Direction

Start at `docs/INDEX.md`. Vision, architecture, decision log and roadmap are
DES-014 to DES-017; add a DES-016 row when a decision lands. Find a doc from
the index, then a section index; never read whole folders. Schema and writing
rules: `docs/README.md`. UI/UX: `apps/web/DESIGN.md` and mockups on `/brand`.

## Layout

- `apps/web`: Vite 8, React 19, Tailwind 4, shadcn (Base UI, `base-nova`)
  on `127.0.0.1:5173`, proxies `/fcp` (bootstrap + WS) and `/blobs`. Pages
  use `components/page`, labels/ids `components/data`.   Routes (FCP via
  sdk-react): `/`→`/docket`, `/inbox`, `/workflows(/:id)`, `/runs`,
  `/connectors`, `/library`, `/skills`, `/files`, `/brand`, `/dev/kit`;
  Settings is a sidebar panel (not a route); `/mock/*` redirects to the
  same paths. No `hono/client`.
  FCP client: MessagePort in Electron, WebSocket via `/fcp/bootstrap`.
- `apps/desktop`: Electron main + preload (`connect()`, `revealPath`,
  `notifyInboxItem`, `browserSignIn`) + utilityProcess host, or attach via
  `engine.lock`; `host.revealPath` / `host.notifications` /
  `host.browserSignIn`; `flows-blob://` BlobStore; loads the web build;
  Playwright smoke in `apps/desktop/smoke`.
- `apps/server`: Hono + `tsx` on `127.0.0.1:8787`, takes `engine.lock`.
  `/health`; `/` + `/fcp` FCP over ws (loopback Host/Origin + lock token)
  with `GET /fcp/bootstrap`; `/blobs` GET/PUT (BlobStore). No REST `/api`.
  Shared FCP host stack: `server/fcp-host` (also used by `apps/cli`).
- `apps/cli`: `flows` command (`engine --stdio`, `inbox`, `run`); attaches
  via `engine.lock` or hosts in-process; FCP over sdk (ws or linked/ndjson).
- `packages/engine`: SQLite event log (via EventStore) + settings, connectors,
  MCP trust, connections, library, work items, work copies, CliAdapter,
  trust markers, queued runs; `nodes/` (walk, loops, executors, tick, fold).
- `packages/core`: UI-free kernel (ports, `bindEngine`, `runs/` decide+fold +
  actor + scheduler, `nodes/` NodeKind+StepContext for trigger/asset/llm/
  condition/approval/notify,
  `inbox/` projection + FCP list/answer/dismiss (approval, permission,
  question, plan_review), agents permission chain + ask gates, MCP
  gateway bridge + launch spec, testing fakes); no Node I/O.
- `packages/adapters-node`: Node adapters for the core ports (SQLite events,
  fs docs, secrets, watcher, process runner + sandbox, gateway unix socket),
  `engine.lock`.
- `packages/agent-acp`: ACP runtime + Cursor and generic profiles (`profiles/`);
  `testing/fake-agent` (stdio).
- `packages/protocol`: JSON-RPC 2.0 `RpcPeer` (+ `$/cancel_request`),
  transports: linked, `wsTransport`, `messagePortTransport`, ndjson (`/node`).
- `packages/sdk` (`createClient`: queue, backoff, resync) and
  `packages/sdk-react` (`useQuery`, `useSubscription`); `packages/mcp-gateway`
  (stdio MCP server forwarding to the engine socket).
- `packages/contracts` (`packages/shared` re-export shim): zod for API
  (`runSummarySchema`, `workItemSchema`), branded ids (`CardId`, `RunId`,
  `WorkflowId`, `StepId`, `ConnectorId`, `SkillSlug`, `LibItemId`),
  websocket, node workflow (`workflowSchema`), `connection.yaml`, library
  (LibItem `v<n>` + FCP list/get/pull/pin/set_tags/remove/providers),
  `resources.json`, `config.yaml` `library.maxBytes`, events,
  `findLoopEdges`, YAML edits that keep comments and key order.
- `packages/ui`: shadcn, domain-free AI Element patterns, `globals.css`.
- `apps/e2e`: Playwright, temp `FLOWAPP_HOME` of node workflows
  (`layout.spec.ts` baselines, shell smoke, FCP page specs).
- `packages/docs-tools`: docs index generator and checker.
- `docs/`: designs (`DES-*`), backlogs (`BL-*`), generated indexes.

## Commands

Run from the repo root with pnpm:

```sh
pnpm install
pnpm dev # server and web
pnpm build # typecheck and build web
pnpm typecheck
pnpm lint           # eslint, then docs:check
pnpm lint:fix
pnpm format
pnpm format:check
pnpm test # vitest
pnpm test:e2e # playwright
pnpm docs:index
pnpm docs:check
```

## Done means

`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` for UI or
API changes, all pass.

## Conventions

- Branch from `develop`, target PRs at it. Never push or merge to `main`
  without explicit approval.
- Local only: bind to `127.0.0.1`, never `0.0.0.0`. macOS only for now.
- App data lives under `FLOWAPP_HOME` when set, otherwise `~/.flowapp`.
- Project rules: `.cursor/rules/`.
