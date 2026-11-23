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
  on `127.0.0.1:5173`, proxies `/api`; node cards in `src/nodes/`. Pages use `components/page`, labels
  and ids `components/data`. Sidebar Platform (Home, Work items, Workflows,
  Runs, Connections), Workflows group, Settings;
  `/work-items` and `/work-items/:id` (Context links + Freshness, Runs,
  Start, Notes, Attachments; Ad hoc / Library / Rally source Badge);
  `/connections` (Connections/Library tabs, size warning at 80%) and
  `/connections/:id` (sign-in, MCP allow, local data, used by, refresh,
  policy); Settings lists allowed MCP servers; `/workflows` and `/runs`
  (grouped by work item); one Start run dialog from work item and workflow
  headers, Allow agent CLI dialog; Home Needs you (incl. publish +
  connection), expired sign-ins, Work items; Impact/Freshness/Policy on
  `/dev/kit`; workflow Overview/Editor/Runs; run view Tasks/Changes/Library tabs.
- `apps/server`: Hono + `tsx` on `127.0.0.1:8787`. Health, workflow
  create/rename/delete (409 while live), GET/PUT (hash, 409), memory
  CRUD, file GET/PUT, trust GET/PUT and preflight (CLIs of the nodes), GET
  `/cli/:cli/models`, connections CRUD/check/sign-in,
  `GET/PUT /mcp-trust`, node GET/PUT, `/layout`, `GET /connectors`, library
  GET/pull/clear (usage + retention), work item CRUD, run REST (list/start/
  cancel/rerun/retry/approve/reject/delete, changes), run input/files, log/
  summary/out (+ file), websocket snapshots, `runs_changed`, log chunks,
  file watches.
- `packages/engine`: SQLite event log + settings (`cli_trust`; rows it
  cannot parse, such as old task runs, are skipped), connectors (github
  draft PR, confluence via MCP, rally, fake), MCP trust allowlist,
  connections, library pull/pins/retention (`library.ts`, maxBytes, sweep,
  clear, `resources/` + `RESOURCE_*`), work items, cookie secrets under
  `secrets/` (Chrome sign-in, sandbox denies), propose work copies (`work/`,
  change sets, publish gate incl. trust-agent-review, Cloud effects),
  CliAdapter, model/effort resolve, trust markers, `agents` limits, run
  deletion, frozen `RUN_INPUT`, queued runs, summary cache,
  `<workflow>/.cache`; `nodes/` (walk, loops, executors incl. `publish.ts`,
  `answers.ts` (named answers), `tickNodes`, retry, `partial.ts`,
  `run-state.ts` = the run fold).
- `packages/core`: UI-free kernel (`EngineError`, ports, `bindEngine`, testing
  fakes); `bindInitialize` gates FCP until handshake; `contracts` +
  `protocol`; no Node I/O.
- `packages/adapters-node`: Node port adapters (`DocumentStore` fs + atomic
  write); contract tests against core fakes.
- `packages/protocol`: JSON-RPC 2.0 `RpcPeer`, `Transport`, `createLinkedTransports()`.
- `packages/contracts` (`packages/shared` re-export shim): zod for API
  (`runSummarySchema`, `workItemSchema`), websocket, node workflow
  (`workflowSchema`), `connection.yaml`, library list/pull/clear/usage,
  `resources.json`, `config.yaml` `library.maxBytes`, events, `findLoopEdges`,
  YAML edits that keep comments and key order.
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
