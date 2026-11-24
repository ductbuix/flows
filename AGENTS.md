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
  on `127.0.0.1:5173`, proxies `/api`; node cards in `src/nodes/`; pages use
  `components/page`, labels/ids `components/data`. Routes: Home (Needs you,
  expired sign-ins), `/work-items(/:id)`, `/workflows` (Overview/Editor/
  Runs), `/runs` (by work item; run view Tasks/Changes/Library),
  `/connections(/:id)` (Library tab, sign-in, MCP allow), Settings,
  `/dev/kit`; one Start run dialog, Allow agent CLI dialog.
- `apps/server`: Hono + `tsx` on `127.0.0.1:8787`, takes `engine.lock`. REST
  `/api`: health, workflows (hash/409), memory, files, trust + preflight,
  CLI models, connections + sign-in, `/mcp-trust`, nodes, `/layout`,
  connectors, library, work items, runs (start/cancel/rerun/retry/approve/
  reject/delete, changes, input/files, log/summary/out); websocket
  snapshots, `runs_changed`, log chunks, file watches. `/` + `/fcp`: FCP
  over ws (loopback Host/Origin + lock token): ping, workflow/list|get,
  run/list|get, run_changed.
- `packages/engine`: SQLite event log (via EventStore) + settings, connectors
  (github draft PR, confluence via MCP, rally, fake), MCP trust, connections,
  library pull/pins/retention, work items, cookie secrets, work copies +
  publish gate, CliAdapter, model/effort, trust markers, `agents` limits,
  queued runs, summary cache; `nodes/` (walk, loops, executors incl.
  `publish.ts`, `answers.ts`, `tickNodes`, retry, `partial.ts`,
  `run-state.ts` = the run fold).
- `packages/core`: UI-free kernel (`EngineError`, ports: Document/Event/
  Secret stores, FileWatcher, ProcessRunner, AgentRuntime; `bindEngine`,
  `bindInitialize` gate, `runs/` pure decide+fold, `agents/` permission
  chain, testing fakes + contract suites); `contracts` + `protocol`; no
  Node I/O.
- `packages/adapters-node`: Node adapters for the core ports (SQLite events,
  fs docs, secrets, watcher, process runner + sandbox), `engine.lock`.
- `packages/agent-acp`: ACP `AgentRuntime` (later); scripted fake agent
  over stdio for tests (`testing/fake-agent`).
- `packages/protocol`: JSON-RPC 2.0 `RpcPeer` (+ `$/cancel_request`),
  transports: linked, `wsTransport`, `messagePortTransport`, ndjson (`/node`).
- `packages/sdk` (`createClient`: queue, backoff, resync) and
  `packages/sdk-react` (`useQuery`, `useSubscription`); `packages/mcp-gateway`
  (stdio MCP server forwarding to the engine socket).
- `packages/contracts` (`packages/shared` re-export shim): zod for API
  (`runSummarySchema`, `workItemSchema`), branded ids (`CardId`, `RunId`,
  `WorkflowId`, `StepId`, `ConnectorId`, `SkillSlug`, `LibItemId`),
  websocket, node workflow (`workflowSchema`), `connection.yaml`, library
  list/pull/clear/usage, `resources.json`, `config.yaml` `library.maxBytes`,
  events, `findLoopEdges`, YAML edits that keep comments and key order.
- `packages/ui`: shadcn, domain-free AI Element patterns, `globals.css`.
- `apps/e2e`: Playwright, temp `FLOWAPP_HOME` of node workflows
  (`layout.spec.ts` baselines, `node-*.spec.ts`).
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
