# `server` — FCP daemon and shared FCP host stack

Path: `apps/server`. Hono HTTP app on `@hono/node-server`, run with `tsx`
(no build). Two roles:

1. **Daemon** (`src/index.ts`): binds `127.0.0.1:8787`, takes
   `$FLOWAPP_HOME/engine.lock`, serves `/health`, `/`, `/fcp/bootstrap`,
   `/fcp` (FCP over WebSocket) and `/blobs`.
2. **Library** for other hosts via two package exports:
   `server/app` (`createApp`) and `server/fcp-host` (`createFcpHost`,
   `bindFcpTransport`). The CLI (`apps/cli`) and desktop utility process
   (`apps/desktop`) import `server/fcp-host` so every host runs the same
   method stack.

There is **no REST `/api`**; every domain call goes over FCP (JSON-RPC 2.0,
see [protocol.md](../packages/protocol.md) and DES-040). Method params /
results are zod schemas in `@workspace/contracts`; the method handlers
themselves mostly live in `@workspace/core` (`create*Bindings`) and are
wired here with Node adapters from `@workspace/adapters-node`.

## package.json

```json
{
  "name": "server",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "exports": { "./app": "./src/app.ts", "./fcp-host": "./src/fcp-host.ts" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^2.1.11",
    "@workspace/adapters-node": "workspace:*",
    "@workspace/agent-acp": "workspace:*",
    "@workspace/contracts": "workspace:*",
    "@workspace/core": "workspace:*",
    "@workspace/protocol": "workspace:*",
    "hono": "^4.13.19",
    "tsx": "^4.23.15",
    "ws": "^8.23.0",
    "yaml": "^2.9.1",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^26.6.6",
    "@types/ws": "^8.18.2",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1"
  }
}
```

Exports point at `.ts` sources; consumers run them through `tsx`, Vite
or esbuild. All relative imports use explicit `.ts` extensions. `yaml` is
a declared dependency but not imported directly by `src` (YAML handling
goes through `@workspace/contracts`).

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

Root `tsconfig.json`: `target ES2022`, `module ESNext`,
`moduleResolution bundler`, `skipLibCheck`, `strict`.

## eslint.config.js

Flat config (`eslint/config` `defineConfig`):

1. `globalIgnores(["dist"])`.
2. `noCycleBlock` from `../../eslint-dependency-guards.mjs`
   (`import-x` plugin registered as `import`; rule
   `import/no-cycle: ["error", { maxDepth: Infinity }]` on `**/*.{ts,tsx}`).
3. `**/*.ts`: `js.configs.recommended` + `tseslint.configs.recommended`,
   `languageOptions.globals = globals.node`.
4. `**/*.{ts,tsx}`: `max-lines: ["warn", {max: 200, skipBlankLines: true, skipComments: true}]`.
5. `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`: same rule with `max: 300`.

No vitest config file: vitest defaults (picks up `src/**/*.test.ts`).

## Files

```
src/
  index.ts                daemon entry: connectors, host, lock, serve, signals
  app.ts                  createApp(): Hono app with all HTTP routes
  fcp-routes.ts           Host/Origin/token guards, index + bootstrap + WS upgrade
  fcp-index.ts            fcpIndexHtml(): tiny HTML exposing window.__FLOWS_FCP__
  blob-routes.ts          GET/PUT /blobs with lock token
  fcp-host.ts             createFcpHost() + bindFcpTransport(): shared method stack
  engine-bus.ts           engine events -> UpdateBus run/update run_changed + extras
  fcp-run-updates.ts      step_state / run_finished updates + domain run.finished
  fcp-run-read.ts         run/list, run/get (+ pageRunSummaries)
  fcp-run-commands.ts     run/start, cancel, rerun, retry_step, delete, get_log, get_changes
  fcp-run-start.ts        startRunForFcp(): parse workflow, validate inputs, pin, tryStart
  fcp-workflow-read.ts    workflow/list, workflow/get
  fcp-workflow-write.ts   workflow/create, save, rename, delete, save_layout, validate
  fcp-docket.ts           docket index/store + read/write bindings
  fcp-inbox.ts            inbox projection + answer routing to live runs
  fcp-library.ts          library providers + pull jobs
  fcp-skills.ts           workspace skill catalog + install/sources bindings
  fcp-settings.ts         settings/* bindings (CLI probe, app trust, MCP trust)
  fcp-connectors.ts       connector CRUD/check/sign-in bindings
  fcp-files.ts            file/* bindings, reveal via client host request
  core-run-host.ts        CoreRunHost: RunActor + Scheduler over engine EventLog
  core-run-session.ts     live-run table, scheduler (caps), abort controllers
  core-run-start.ts       startCoreRun(), retryCoreStep()
  core-run-resume.ts      resumeCoreRuns() on host start
  core-run-prepare.ts     prepareCoreRunDir(): freeze graph/input/node files
  core-run-partial.ts     seedCorePartial(), copyPartialInput() for only/from runs
  core-run-publish.ts     createHostPublishPort(): PublishPort over connectors
  node-workflow-files.ts  read/write workflow.yaml with rename, trash, node files
  node-trash.ts           trash stamp + unique trash dir + orphan folder scan
  layout-files.ts         workflow.layout.json read/write/move ids
  workflow-lifecycle.ts   create/rename/delete workflow dirs
  workflows-fs.ts         listWorkflowSummaries()
  workflow-files.ts       workflowYamlPath()
  run-files.ts            attempt root resolution, log chunks, out/ file helpers
  run-steps.ts            stepsOfRun(), stepOfNode() -> RunStep[]
  idempotency.ts          IdempotencyStore (requestKey -> result)
  hash.ts                 hashContent(): sha256 hex
  test-utils.ts           settle(engine, runId, ms) for tests
  fcp-harness.ts          test harness: real server on free port, ws helpers
  *.test.ts               vitest suites (see Tests)
```

## Environment variables

| Var                      | Read in                                                  | Effect                                                                       |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `PORT`                   | `index.ts`, `app.ts` default                             | Listen port; default `8787`.                                                 |
| `FLOWAPP_HOME`           | via `createHost()` / `resolveAppHome()` in adapters-node | App home; default `~/.flowapp`.                                              |
| `FLOWAPP_FAKE_CONNECTOR` | `index.ts`                                               | `"1"` registers `fakeConnector` (e2e/demos only).                            |
| `PW_WEB_PORT`            | `fcp-routes.ts` (on every check)                         | Extra Vite dev port added to Host/Origin allowlists when a positive integer. |

The core run host passes the whole `process.env` to the node effect runner
(`processEnv`) for command/agent steps.

## Daemon startup (`src/index.ts`)

Module-level, in order:

1. `registerBuiltinConnectors()`; if `FLOWAPP_FAKE_CONNECTOR === "1"`,
   `registerConnector(fakeConnector)`.
2. `engine = createHost()` (adapters-node; home from `FLOWAPP_HOME` or
   `~/.flowapp`); `engine.startLibraryRetention()`.
3. `port = Number(process.env.PORT ?? 8787)`.
4. `fcpToken = randomBytes(32).toString("base64url")` (43 chars, per launch).
5. `fcpUrl = "ws://127.0.0.1:${port}/fcp"`.
6. `acquireLock(engine.home, { url: fcpUrl, token: fcpToken })`. If the
   result has `attachTo`:
   - owner URL not matching `/^wss?:\/\//` → stderr
     `FLOWAPP_HOME engine busy (in-process), pid <pid>`;
   - else stderr
     `FLOWAPP_HOME already owned at <url>; attach instead of starting another daemon`;
   - `process.exit(1)`.
7. `app = createApp({ engine, fcpToken, port })` (this builds the FCP host,
   which resumes live runs; see below).
8. `serve({ fetch: app.fetch, hostname: "127.0.0.1", port,
websocket: { server: new WebSocketServer({ noServer: true }) } }, cb)`;
   `cb` logs `server on http://127.0.0.1:<port>` to stdout.

Shutdown: `SIGINT` and `SIGTERM` both call `shutdown()`:
`releaseLock(engine.home)` → `engine.close()` →
`server.close(() => process.exit(0))`. (The FCP host is not disposed
explicitly.)

### engine.lock (adapters-node, used here)

File `$FLOWAPP_HOME/engine.lock`, mode `0600`, JSON
`{"pid": <int>, "url": "<string>", "token": "<string>"}`. `acquireLock`
creates the home dir, then up to 8 attempts of `O_WRONLY|O_CREAT|O_EXCL`
write; on `EEXIST` it reads the file — valid schema and pid alive
(`process.kill(pid, 0)`, `EPERM` counts as alive) → `{ attachTo: {url,
token, pid} }`; otherwise unlink and retry. After 8 failures throws
`could not acquire engine.lock under <home>`. `releaseLock` removes the
file unless it names another pid. `peekLock(home)` returns the live owner
`{url, token, pid}` or `null`. URL conventions across hosts:

| Owner                             | `url` written                     |
| --------------------------------- | --------------------------------- |
| daemon                            | `ws://127.0.0.1:<port>/fcp`       |
| CLI in-process / `engine --stdio` | `inproc://flows-cli`              |
| desktop utility process           | `flows-desktop://utility-process` |

Only `ws://`/`wss://` owners can be attached to.

## HTTP app (`createApp`, `src/app.ts`)

```ts
type CreateAppOptions = { engine: Host; fcpToken?: string; port?: number }
function createApp(opts): Hono
```

Defaults: `fcpToken = "test-fcp-token"`, `port = Number(process.env.PORT ?? 8787)`.
Calls `createFcpHost(engine)` once (one host per app). Routes:

| Method | Path                   | Handler                  | Guards                                    | Responses                                                     |
| ------ | ---------------------- | ------------------------ | ----------------------------------------- | ------------------------------------------------------------- |
| GET    | `/health`              | inline                   | none                                      | `200 {"ok":true,"version":"0.0.1"}` (`Health` schema)         |
| GET    | `/`                    | `fcpIndexResponse`       | Host                                      | `403 text "Forbidden"` or `200 text/html` index page          |
| GET    | `/fcp/bootstrap`       | `fcpBootstrapResponse`   | Host + Origin                             | `403 text "Forbidden"` or `200 {"token","url"}`               |
| GET    | `/fcp`                 | `fcpUpgrade` (WebSocket) | Host + Origin + token, checked at upgrade | upgrade; then close `4401 "unauthorized"` if any guard failed |
| PUT    | `/blobs` (sub-app `/`) | `blobRoutes`             | `token` query                             | see Blobs                                                     |
| GET    | `/blobs/:id`           | `blobRoutes`             | `token` query                             | see Blobs                                                     |
| *      | anything else          | Hono default             | —                                         | `404`                                                         |

No CORS middleware, no logging middleware.

### Guards (`src/fcp-routes.ts`)

Constants: `FCP_AUTH_CLOSE = 4401`, `FCP_DEV_ORIGIN_PORT = 5173`.

- `fcpDevOriginPorts()`: `{5173}` plus `Number(PW_WEB_PORT)` when it is a
  positive integer. Evaluated on every call.
- `fcpAllowedHosts(port)`: `127.0.0.1:<p>`, `localhost:<p>`, `[::1]:<p>`
  for `p` in `{port} ∪ devPorts` (Vite proxies `/fcp`; without
  `changeOrigin` Host stays on the Vite port).
- `fcpAllowedOrigins(port)`: `http://127.0.0.1:<p>`, `http://localhost:<p>`
  for the same ports (no `[::1]` origins, no https).
- `fcpHostAllowed(c, port)`: `Host` header present, non-empty, and its
  **lowercased** value is in the host set (exact match incl. port).
- `fcpOriginAllowed(c, port)`: `true` when `Origin` absent or empty (CLI,
  desktop bridge); otherwise exact (case-sensitive) membership.
- `fcpTokenMatches(c, expected)`: query `token` present, same byte length,
  `crypto.timingSafeEqual`.
- `fcpAuthorized = host && origin && token`.

### `GET /` — index page (`fcp-index.ts`)

Host guard only (no Origin check). Body (`c.html`) is exactly:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Flows</title>
  </head>
  <body>
    <script>
      window.__FLOWS_FCP__ = { token: "<token>", url: "ws://<Host header>/fcp" }
    </script>
  </body>
</html>
```

(trailing newline). `url` uses the request's `Host` header verbatim
(fallback `127.0.0.1:<port>`), so a client on `localhost:8787` gets
`ws://localhost:8787/fcp`. Payload is `JSON.stringify({token, url})`.

### `GET /fcp/bootstrap`

Host **and** Origin guards. `200` JSON `{ "token": "<token>", "url":
"ws://127.0.0.1:<port>/fcp" }` — URL always uses `127.0.0.1` and the daemon
port (not the Host header). The web app fetches this through the Vite proxy
(`/fcp` proxied with `changeOrigin: true`).

### `GET /fcp` — WebSocket

`upgradeWebSocket((c) => fcpEvents(...))` from `@hono/node-server`. The
WS server is a `ws` `WebSocketServer({ noServer: true })` handed to `serve`.

- If `fcpAuthorized` fails, the upgrade still completes and `onOpen`
  immediately calls `ws.close(4401, "unauthorized")`. Clients see close
  code 4401.
- Otherwise `onOpen`: if `ws.raw` is missing or lacks `addEventListener`,
  `ws.close(1011, "no websocket")`; else
  `bindFcpTransport(wsTransport(ws.raw), engine, host, { blobsHttp:
"http://127.0.0.1:<port>/blobs" })`.

The token is checked once at upgrade; there is no further auth message
before `initialize`.

### Blobs (`src/blob-routes.ts`)

`blobRoutes(token: string, store: BlobStore = getBlobStore()): Hono`,
mounted at `/blobs`. Token compare is the same constant-time compare as FCP
(missing → false, length mismatch → false).

| Route            | Query (zod)                                                      | Steps                                                                                                                                                                                                  | Responses                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /blobs`     | `token: string min1`, `scope: string min1`, `name?: string min1` | parse (empty `name` → validation fail) → token → body present → mime = `Content-Type` before `;`, trimmed, else `application/octet-stream` → `store.put(scope, body /*ReadableStream*/, {name, mime})` | `400 {"message":"bad request"}`; `401 {"message":"unauthorized"}`; `400 {"message":"empty body"}`; `200 <BlobRef JSON>`                                                           |
| `GET /blobs/:id` | `token: string min1`                                             | parse → token → `store.open(id)`                                                                                                                                                                       | `400 {"message":"bad request"}`; `401 {"message":"unauthorized"}`; `404 {"message":"not found"}`; `200` streamed bytes via `hono/streaming` `stream()` (no explicit Content-Type) |

Validation runs before the token check, so a missing token is `400`, a
wrong token `401`. No Host/Origin guard on `/blobs`. `BlobRef` and the
on-disk layout (`blobs/data/<id>`, `blobs/meta/<id>.json` with
`{id, scope, name, mime, size}`) belong to adapters-node `getBlobStore()`.

## FCP host stack (`src/fcp-host.ts`)

```ts
type FcpHost = {
  bus: UpdateBus
  idempotency: IdempotencyStore
  extraBindings: Partial<MethodBindings>
  connectors: ConnectorsFcp
  coreRuns: CoreRunHost
  dispose: () => void
}
function createFcpHost(engine: Host): FcpHost
type BindFcpTransportOptions = { blobsHttp?: string }
function bindFcpTransport(
  transport: Transport,
  engine: Host,
  host: FcpHost,
  options?: BindFcpTransportOptions
): void
```

`engineInfo = { name: "flows", version: "0.0.1" }`.

### createFcpHost — order matters

1. `bus = new UpdateBus()`, `events = createEventBus()` (core).
2. `unsubBus = bindEngineToBus(engine, bus, events)`.
3. `docket = createDocketFcp(engine, bus, events)` (subscribes to
   `run.finished` before any run can finish).
4. `coreRuns = createCoreRunHost(engine, { onNotice })` where `onNotice(n)`
   publishes `notice/update` `{ kind: "notice_added", notice: { title,
text, runId, workflowId, nodeId, channel: n.channel ?? "app" } }`.
5. `void coreRuns.resumeAll().catch(err => console.error("resume runs failed", err))`.
6. `engine.bootHousekeeping()`.
7. `inbox = createInboxFcp(engine, bus, coreRuns)`,
   `library = createLibraryFcp(engine, bus)`,
   `skills = createSkillsFcp(engine, bus)`,
   `settings = createSettingsFcp(engine)`,
   `connectors = createConnectorsFcp(engine, bus, inbox.inbox)`,
   `idempotency = new IdempotencyStore()`.
8. `extraBindings = { ...docket.bindings, ...inbox.bindings,
...library.bindings, ...skills.bindings, ...settings }`.
9. `dispose()`: `coreRuns.dispose()`, `unsubBus()`, `docket.dispose()`,
   `inbox.dispose()`, `skills.dispose()` (library/settings/connectors have
   nothing to dispose).

One `FcpHost` is shared by all peers of a process (daemon: all sockets;
desktop: all MessagePorts).

### bindFcpTransport — per connection

1. `peer = new RpcPeer(transport)`, `connection = createFcpConnection()`
   (core; holds negotiated client capabilities), `ac = new AbortController()`,
   `peerId = randomUUID()`.
2. `{ bindings: subBindings, dispose: subDispose } =
createSubscribeBindings(host.bus, peer, peerId)` (core: `subscribe` /
   `unsubscribe`, replay since `seq`, resync list).
3. `transport.onClose(() => { ac.abort(); subDispose.dispose() })`.
4. `bindInitialize(peer, connection, { engineInfo, workspace: { home:
engine.home, id: engine.home }, ...(blobsHttp ? { engineCapabilities: {
blobs: { http: blobsHttp } } } : {}) })`. Core fills defaults
   `agents: []`, `nodeKinds: []`; the daemon result is therefore
   `engineCapabilities: { agents: [], nodeKinds: [], blobs: { http:
"http://127.0.0.1:<port>/blobs" } }`. Stdio / linked / MessagePort hosts
   omit `blobs`.
5. `bindEngine(peer, bindings, { signal: ac.signal }, { connection })`
   with bindings merged in this order (later keys win):
   `ping` → workflow read → workflow write → subscribe/unsubscribe → run
   read → run commands → file → connectors (`host.connectors.bindings({peer,
connection})`) → `host.extraBindings`.

`ping`: `defineBinding(pingMethod, () => ({ ok: true }))`.

### Error mapping

Handlers throw `engineError(code, message, data?)` (core). Core maps it to
a JSON-RPC error with the FCP code's numeric code and
`data = { code: "<fcp code>", ...data }` (non-object data → `{code,
detail}`). Codes used in this package: `not_found`, `invalid_params`,
`conflict`, `busy`, `failed_precondition`, `internal`.

## Method bindings defined in this package

### workflow/* (`fcp-workflow-read.ts`, `fcp-workflow-write.ts`)

| Method                                           | Behavior                                                                                                                                                                                               | Errors                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow/list` `{cursor?, limit?}`              | `listWorkflowSummaries` → page (limit default 100). Cursor = id of last item; unknown cursor restarts at 0; `next` = last id of page only if more remain. Each item parsed by `workflowSummarySchema`. | —                                                                                                                                                                         |
| `workflow/get` `{id}`                            | `readNodeWorkflowDetail` → `{ id, yaml, hash: sha256(yaml), workflow, errors, layout }` (parsed by `workflowDetailSchema`)                                                                             | `not_found "Workflow not found: <id>"`                                                                                                                                    |
| `workflow/create` `{id, goal, name?}`            | `createWorkflow`; publish `workflow/update {kind:"workflow_changed", workflowId, summary}`; return summary                                                                                             | `conflict "Workflow already exists: <id>"`; `invalid_params "Invalid workflow id: <id>"`                                                                                  |
| `workflow/save` `{id, yaml, baseHash, renames?}` | `writeNodeWorkflowYaml`; publish `workflow_changed`; return detail                                                                                                                                     | `not_found`; `conflict "Stale baseHash" {current:{yaml,hash}}`; `invalid_params "Invalid workflow yaml" {detail}`; `internal "Failed to move removed task folder" {path}` |
| `workflow/rename` `{id, newId}`                  | `renameWorkflow`; if id changed publish `workflow_removed {workflowId: oldId}`; then `workflow_changed` for new id; return `{id}`                                                                      | `not_found`; `busy "Workflow has a live run: <id>"`; `conflict "Workflow already exists: <newId>"`; `invalid_params "Invalid workflow id: <newId>"`                       |
| `workflow/delete` `{id}`                         | `deleteWorkflow`; publish `workflow_removed`; return `{}`                                                                                                                                              | `not_found`; `busy`; else `invalid_params <kind>`                                                                                                                         |
| `workflow/save_layout` `{id, layout}`            | `writeLayout`; publish `layout_changed {workflowId, layout: written}`; return written                                                                                                                  | `not_found`                                                                                                                                                               |
| `workflow/validate` `{yaml}`                     | `parseNodeWorkflowYaml` → `{workflow, errors}`                                                                                                                                                         | —                                                                                                                                                                         |

`workflow_changed` summary after save/rename: from `listWorkflowSummaries`
if present, else built from the parsed detail; skipped if neither exists.

### run/* (`fcp-run-read.ts`, `fcp-run-commands.ts`, `fcp-run-start.ts`)

Constants: `DEFAULT_LIST_LIMIT = 100`, `LIST_SCAN_LIMIT = 50_000`,
`CHUNK_BYTES = 64 * 1024`.

| Method                                                                                            | Behavior                                                                                                                                                                     | Errors                                                                                             |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `run/list` `{cursor?, limit?, cardId?, workflowId?}`                                              | `engine.listRunSummaries({limit: 50000, cardId?, workflowId?})` then `pageRunSummaries(items, cursor, limit ?? 100)` (same cursor rules as workflow/list) → `{items, next?}` | —                                                                                                  |
| `run/get` `{id}`                                                                                  | `{ ...engine.getRunSummary(id), steps: stepsOfRun(engine, id) }`                                                                                                             | `not_found "Run not found: <id>"`                                                                  |
| `run/start` `{workflowId, values?, cardId?, refreshPins?, only?, from?, baseRunId?, requestKey?}` | If `requestKey` cached → return cached `{runId}`. Else `startRunForFcp`; cache `(requestKey, 200, result)`; return `{runId}` immediately (run proceeds in background).       | see startRunForFcp                                                                                 |
| `run/cancel` `{runId}`                                                                            | `await coreRuns.cancel(runId)`; if false → `engine.cancelRun(runId)`; `{}`                                                                                                   | `mapControlError`                                                                                  |
| `run/rerun` `{runId, values?, refreshPins?, only?, from?, baseRunId?, requestKey?}`               | idempotency as start; `engine.fold(runId)`; `startRunForFcp` with `workflowId` from state and `rerunOf: {runId, cardId: state.cardId}`                                       | `not_found "Run not found: <id>"` if missing/deleted; `busy "run is still live"` if running/queued |
| `run/retry_step` `{runId, stepId}`                                                                | `coreRuns.retryStep(runId, stepId)`; `{}`                                                                                                                                    | `mapControlError`                                                                                  |
| `run/delete` `{runId}`                                                                            | `engine.deleteRun(runId)`; `{}`                                                                                                                                              | `mapControlError`                                                                                  |
| `run/get_log` `{runId, stepId, attempt, pass?, stream, offset?}`                                  | `resolveAttemptRoot` → `readLogChunk(root, stream, offset ?? 0)`                                                                                                             | `not_found "attempt not found"`                                                                    |
| `run/get_changes` `{runId, connectionId}`                                                         | fold → run dir → `diffWorkCopy({home, runRoot, connectionId})` → `runChangesResponseSchema.parse`                                                                            | `not_found` run; message matching `/unknown connection                                             | unknown connector/`→`not_found`; other → `invalid_params` |

`mapControlError(err)` on message: `/unknown run|not found|deleted/i` →
`not_found`; `/cannot delete live|not live|cannot be retried|not awaiting/i`
→ `busy`; else `invalid_params`. Non-Error → `"request failed"`.

`IdempotencyStore`: in-memory `Map<requestKey, {status, body}>` per host,
never evicted; only `body.runId` (string) is reused.

**startRunForFcp(engine, args, coreRuns)**:

1. `workflows/<id>/workflow.yaml` must exist → else `not_found
"Workflow not found: <id>"`.
2. `parseNodeWorkflowYaml`; no workflow or any error → `invalid_params`
   with first error message (or `"invalid workflow"`).
3. `partial = {only, from, baseRunId}` when `only` or `from` defined;
   `base = engine.latestNodeRunId(workflowId, baseRunId)` when partial.
4. `decls` = `inputs` of the first `kind: "trigger"` node (or `[]`).
5. `keepInputs = base !== undefined`. Values: if keepInputs `{}`; else if
   no decls, raw values; else validate with `buildManualValuesSchema(decls)`
   → on failure `invalid_params "invalid_input" {fields: {<path[0] or
"values">: message}}`; then `applyInputDefaults`.
6. Card: `rerunOf ? rerunOf.cardId : args.cardId`; if defined, the card
   file (`cardPath(cardId)` under home) must exist → else
   `invalid_params "unknown_card: <id>"`.
7. In a try: `runId = randomUUID()`; `pins = await engine.pinNodeRun({graph,
runId, cardId, pinFromRunId?: rerunOf.runId ?? base, refreshPins})`;
   `inputText = (keepInputs || decls.length>0) ? undefined :
values?.text`; `inputs = (!keepInputs && decls.length>0) ? {decls,
values, files: []} : undefined`; partial bases = `baseRunId` first, then
   every other non-deleted run of the workflow with a graph (excluding the
   new runId) — unknown `baseRunId` throws `invalid_params "unknown base
run <id>"`; `coreRuns.tryStart({graph, runId, pins, inputText, inputs,
cardId, partial?})`.
8. Errors inside the try → `mapStartError`: `/unknown|not found/i` →
   `not_found`; `/conflict|live|still/i` → `conflict`; else
   `invalid_params`.

**Run log chunks** (`run-files.ts`): `resolveAttemptRoot(engine, runId,
taskId, attempt, pass?)` → `null` if run missing/deleted, task unknown,
no step for that pass (latest when `pass` omitted) or
`step.attempts < attempt`; else `attemptRootOf(stepDir(runDir, taskId,
pass), attempt)`. `readLogChunk(root, stream, offset)` reads
`<root>/<stream>.log`: missing file or `offset >= size` → `{stream, offset,
nextOffset: offset, text: "", eof: true}`; else up to 64 KiB from `offset`,
`text` utf8, `eof = nextOffset >= size`. Other helpers (not bound to FCP
today): `readSummary` (`SUMMARY.md` → `{text, missing}`), `listOutFiles`
(walk `out/`, dirs and files, sorted by path), `resolveOutPath` (rejects
empty, NUL, `..` segments, escapes), `readOutTextFile`.

**RunStep shape** (`run-steps.ts`): for each graph node with a step, latest
pass: `{nodeId, kind, pass, attempts, status: stepTaskStatus(step.status),
branch?, failReason?, question?, decision?, answer?, reused?: true,
startedAt?, endedAt?}` (from `step.current`). `stepOfNode` picks one.

### Updates published by this package

| Notification      | `kind`                                                     | When                                                                                 | Payload                                                                                              |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `run/update`      | `run_changed`                                              | every engine event (`engine.onEvent`)                                                | `{runId, summary: engine.getRunSummary(runId)}`                                                      |
| `run/update`      | `step_state`                                               | event type in STEP set and has `nodeId` (or legacy `taskId`) and the node has a step | `{runId, step: RunStep}`                                                                             |
| `run/update`      | `run_finished`                                             | event `run_succeeded`/`run_failed`/`run_cancelled` and summary status terminal       | `{runId, status, summary}`; also `events.emit("run.finished", {runId, workflowId, status, cardId?})` |
| `workflow/update` | `workflow_changed` / `workflow_removed` / `layout_changed` | workflow writes                                                                      | see table above                                                                                      |
| `notice/update`   | `notice_added`                                             | notify step stored a new notice                                                      | see createFcpHost                                                                                    |

STEP set: `step_started, step_done, step_failed, step_skipped,
step_approved, step_rejected, step_retry_requested, step_cancelled,
attempt_started, attempt_launched, attempt_finished, attempt_interrupted,
approval_requested`. Publish order per event: `run_changed`, then
`step_state`, then `run_finished`. Other namespaces (`docket/update`,
`inbox/update`, `connector/update`, `library/update`, `skill/update`) are
published by core services given `bus`.

### Domain modules (wiring only; behavior in core)

| File                | Builds                                                                                                                                                                                                                                                                                                                                               | Bindings                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fcp-docket.ts`     | `createNodeDocumentStore({root: home})`, `createDocketStore({docs, clock})`, `createNodeFileWatcher({root: home})`, `createDocketIndex({store, watcher, exists: existsSync})` then `index.start()`; `attachRunFinishedRef(events, {store, index, bus})`                                                                                              | `createDocketReadBindings({index, store})` + `createDocketWriteBindings({index, store, bus, blobs: getBlobStore()})`; dispose: runRef, index                                  |
| `fcp-inbox.ts`      | read-only `EventStore` over engine (`append` always `{ok:false, kind:"conflict", lastSeq:0}`; `read(runId, fromSeq=0)` filters `eventsWithSeq` by `seq >= fromSeq`; `tail()` = max seq over all runs); `createInboxService({bus, clock, events, pushAnswer})`; seeds `inbox.rebuild(all stored events sorted by seq)`; `engine.onEvent(inbox.apply)` | `createInboxBindings(inbox)`; dispose: unsubscribe                                                                                                                            |
| `fcp-library.ts`    | providers + connector service + runtime with **only** the CLI transport; `createLibraryService({docs, bus, ids: {id: p => "<p>_<uuid>"}, clock, fetcher: createConnectorLibraryFetcher(...)})`                                                                                                                                                       | `createLibraryBindings(providers, library)`                                                                                                                                   |
| `fcp-skills.ts`     | `createSkillCatalog({roots: [{scope: "workspace", docs, watcher}], bus})` + `catalog.start()`; `createLibrarySkillSourceReader(docs)`. Home (`~`) skills intentionally not scanned.                                                                                                                                                                  | read + install (`{workspaceDocs, catalog, bus, sources}`) + sources (`{docs, bus}`); dispose: catalog                                                                         |
| `fcp-settings.ts`   | trust port over `engine.trustDecision()` → `{trust, homeRealpath, alwaysTrusted: trust==="always"}`; `setTrust("always")` → `engine.setAlwaysTrust()`, else `revokeAlwaysTrust()`                                                                                                                                                                    | `createSettingsBindings({cli: createNodeCliStatusPort(), trust, mcp: createNodeMcpTrustPort(home)})`                                                                          |
| `fcp-connectors.ts` | service over docs; secrets at `<home>/secrets`; `createChromeBrowserSignIn({home})` (import `@workspace/adapters-node/chrome-browser-sign-in`); transports CLI, API (`onUnauthorized: markExpired`), MCP (`{secrets}`); runtime                                                                                                                      | `createConnectorBindings(service, {check: {runtime, bus, clock, onStatusChanged: inbox.applyConnectorStatus}, signIn: {secrets, chromeSignIn, peer?, connection?}})` per peer |
| `fcp-files.ts`      | docs over home; reveal = `createPeerHostReveal(peer, connection, p => join(home, p))` when peer+connection given                                                                                                                                                                                                                                     | `createFileBindings({docs, allowedRoots: [""], reveal})`                                                                                                                      |

`markExpired(connector, detail)`: `service.setStatus(id, {status:
"expired", checkedAt, detail})`, publish `connector/update {kind:
"status_changed", connectorId, status: "expired", checkedAt, detail}`, and
`inbox.applyConnectorStatus({connectorId, name, status: "expired", at})`.

Inbox `pushAnswer(input)`:

- `kind === "approval"`: decision = `optionId === "approved" ? "approved" :
"rejected"`; `coreRuns.answerApproval(...)` true → done; else
  `failed_precondition "No live approval for this inbox item"`.
- other kinds: missing `requestId` → `failed_precondition "ACP inbox answer
is missing requestId"`; `coreRuns.answerAcpAsk({kind, runId, at, nodeId,
pass, requestId, optionId, answers?})` false →
  `failed_precondition "No live ACP session for this inbox item"`.

All `Clock`s are `{ now: () => Date.now() }`.

## Core run host (`core-run-*.ts`)

```ts
type CoreRunHost = {
  tryStart(args: CoreStartArgs): Promise<{ runId: string }>
  isLive(runId): boolean
  answerApproval({ runId, nodeId, decision }): Promise<boolean>
  answerAcpAsk(input: AcpInboxAnswerInput): boolean
  cancel(runId): boolean | Promise<boolean>
  retryStep(runId, nodeId): Promise<boolean>
  resumeAll(): Promise<void>
  abandon(): void // drop live actors without cancel events (crash sim)
  dispose(): void
}
type CoreStartArgs = {
  graph
  runId
  pins?
  inputText?
  inputs?
  cardId?
  partial?: PartialRun
}
```

**Session** (`createCoreRunSession`): `scheduler = createScheduler({
maxConcurrent: 32, maxConcurrentRuns: wf => caps.get(wf) ?? 1 })`;
`trackCap(graph)` sets `caps[graph.id] = graph.limits?.maxConcurrentRuns ??
1`; `live: Map<runId, {actor, workflowId}>`; `aborts: Map<runId,
AbortController>`. `attachLive` creates a fresh AbortController.
`endLive` deletes both and calls `promoteQueued`; `endIfTerminal` calls
`endLive` when actor status is `succeeded|failed|cancelled`.
`promoteQueued(ended)`: snapshot active run ids (minus ended),
`scheduler.endRun(ended)`, call `onActivated(runId)` for each newly active
run.

**createCoreRunHost(engine, {onNotice?})** wires:

- `docs = createNodeDocumentStore({root: home})`, `processRunner =
getProcessRunner()`, `agentRuntime = createAcpRuntime({processRunner})`.
- Store paths: run dir `/workflows/<wf>/runs/<run>`, workflow dir
  `/workflows/<wf>`, agent cwd `<runDir>/nodes/<node>/pass-<n>`; absolute =
  `join(home, path without leading "/")`.
- `acpAsks = createAcpAsks({append: engine.appendLibraryEvent})`.
- `runEffect = createNodeEffectRunner({docs, process, processEnv:
process.env, agentRuntime, acpAsks: acpAsks.gates, publish:
createHostPublishPort({home, absoluteRunDir}), runDirOf, workflowDirOf,
absolutePathOf, agentCwdOf, signalOf: aborts.get(runId)?.signal,
postNotice: n => engine.postNotice(n) && onNotice?.(n)})`.
- Actor: `new RunActor(runId, {events: engine.eventStore(), runEffect})`.
- `activate(runId)`: if live and status `queued`, push `{kind:"activate",
at}` then `{kind:"wake", at}`, `endIfTerminal`. `session.onActivated` =
  activate (errors logged `run <id> activate failed`, then `endLive`).
- `endLive` is wrapped: after ending, `recordUnpublishedLocalEffects({home,
runRoot, runId, append: engine.appendLibraryEvent})`, errors swallowed.
- `answerApproval`: live actor; `latestStep(steps, nodeId)` must be
  `waiting`; push `{kind:"answer", at, nodeId, pass, decision}` then
  `wake`; `endIfTerminal`; true.
- `answerAcpAsk`: false unless live; else `acpAsks.answer(input)`.
- `cancel`: not live → false; `scheduler.cancel`, abort signal, push
  `{kind:"cancel", at}`; finally delete live/abort and activate every
  active scheduler run still `queued`; true.
- `abandon`: `acpAsks.cancelAll()`, abort and drop all live.
- `dispose`: `acpAsks.cancelAll()`, abort each live run and `cancel` it.

**startCoreRun**: `trackCap`; `queued = scheduler.admit(runId, graph.id,
at) === "queued"`; `prepareCoreRunDir` (inputs/inputText skipped for
partial runs); `ensureWorkCopiesFor(runRoot, ids)` for every connection of
`kind:"asset"` nodes with `access:"propose"`; for partial
`copyPartialInput`; `seed = pins.pulledEvents` plus `seedCorePartial(...)`
when `only` or `from`; attach live actor; **not awaited**: push `{kind:
"start", at, runId, graph, cardId, queued, only?, from?, seed?}` then
`endIfTerminal` (errors: log `run <id> failed`, `endLive`). Returns
`{runId}`.

**prepareCoreRunDir** (under `<home>/workflows/<wf>/runs/<run>`): write
`graph.json` (2-space JSON); `inputs` → `materializeRunInput(wfRoot,
runRoot, inputs, cardId)`, else copy `<wf>/input` to `input/` (always
creating `input/`); `inputText` → `input/text.md`; copy each
`<wf>/nodes/<id>` to `frozenDir(runRoot, id)`; copy
`<wf>/workflow.layout.json` to `layout.json`.

**retryCoreStep**: live → throw `task <node> cannot be retried`; no events →
`unknown run <id>`; fold (deleted → `unknown run`); `trackCap`;
`scheduler.forceRunning`; attach; `actor.recover()`; push `{kind:
"retry_step", at, nodeId}` then `wake`; `endIfTerminal`.

**resumeCoreRuns**: for each `engine.listRuns()`, fold stored events; keep
non-deleted `running|queued`; `trackCap`. Sort by `startedAt` (default
`1970-01-01T00:00:00.000Z`) then runId. For each: `scheduler.admit`, attach,
`actor.recover()`; queued and admitted `running` → `activate`; running →
push `wake`, `endIfTerminal`.

**Partial runs** (`core-run-partial.ts`): bases = `partial.bases` minus
the new run, loaded as `{runId, graph: workflowSchema.parse(run_started.graph),
steps: foldAllSteps(events), stepRun: started.only !== undefined}` (skip
if no `run_started` or legacy graph without `nodes`).
`assertPartialReady`; `planPartialSeed` with `unchanged(base, nodeId)` =
canon-equal node, canon-equal incoming edges, and canon-equal base64
snapshot of `nodes/<id>/frozen` in both runs. Copies
`nodes/<id>/pass-<n>` from base to new run (`cpSync` recursive,
dereference). `copyPartialInput` copies the first base's `input/` that
exists.

**Publish port** (`core-run-publish.ts`): `policy(connId)` from
`findConnection(home, id)?.policy` or null; `diff` → `diffWorkCopy({home,
runRoot, connectionId, publishTaskId: nodeId, runId}).changeSet`; `apply`
→ rejected `unknown connection <id>` / `unknown connector <id>`, else
`connector.publish(conn, changeSet, home, {runRoot})`; `advanceBase` →
`advanceWorkCopyBase(runRoot, connId)`.

## Workflow files

Layout under `$FLOWAPP_HOME/workflows/<id>/`: `workflow.yaml`,
`workflow.layout.json`, `nodes/<nodeId>/…`, `nodes/.trash/`, `memory/`,
`input/`, `output/`, `runs/<runId>/`.

- `listWorkflowSummaries`: each dir under `workflows/` with
  `workflow.yaml` → `{id: dirName, name?, goal?, taskCount: nodes.length
or 0}`; invalid files still listed; sorted by `localeCompare`.
- `createWorkflow(id, goal, name?)`: `workflowIdSchema` fail → `invalid`;
  dir exists → `exists`; mkdir `memory`, `input`, `output`; write starter:

  ```yaml
  id: <id>
  name: "<JSON-quoted name>" # only when name given
  goal: <goal>
  nodes:
    - id: start
      kind: trigger
      type: manual
  edges: []
  ```

  returns summary `{id, name?, goal, taskCount: 1}`.

- `renameWorkflow`: invalid newId → `invalid`; same id → ok; source yaml
  missing → `not_found`; target dir exists → `exists`;
  `engine.hasLiveRun` → `live`; `setWorkflowField(yaml, "id", newId)`
  (comment-preserving), write, rename dir, `engine.rebindWorkflowId`.
- `deleteWorkflow`: missing → `not_found`; live → `live`;
  `engine.markWorkflowRunsDeleted`, `rm -rf` dir.
- `writeNodeWorkflowYaml(id, yaml, baseHash, renames)`: missing →
  `not_found`; `sha256(disk) !== baseHash` → `conflict {diskYaml,
diskHash}`; parse errors → `invalid {detail}` (nothing written).
  Renames count only if `from` was on disk, `from` absent and `to` present
  in new yaml; layout ids moved first; write yaml; rename
  `nodes/<from>` → `nodes/<to>` when source is a dir and target absent;
  trash = removed ids (not renamed) ∪ orphan node folders (safe task ids not
  in new set, excluding `.trash`), sorted, each moved to
  `nodes/.trash/<id>-<stamp>[-n]/`; failure → `trash_failed {path:
"nodes/.trash/<id>-<stamp>/"}`. Finally create every **required** file of
  each node's kind (`NODE_KINDS[].files`) as empty, never overwriting.
- `trashStamp(date)`: ISO without `-`, `:`, millis → `YYYYMMDDTHHMMSSZ`.
- Layout: `readLayout` → `layoutFileSchema` or `{version: 1, nodes: {}}`
  on missing/invalid; `writeLayout` returns null without `workflow.yaml`,
  drops ids not in the yaml, writes atomically (`<path>.<pid>.tmp` +
  rename, 2-space JSON + newline); `moveLayoutIds` no-op without file.
- `hashContent(text)` = sha256 hex of utf8.

## Test harness (`fcp-harness.ts`, `test-utils.ts`)

`startFcpServer()`: temp home `flowapp-fcp-*`, token
`"integration-fcp-token"`, free port (listen 0 on 127.0.0.1), `createHost({home})`,
`createApp`, `serve(...)` on 127.0.0.1; `afterEach` (30 s timeout) closes
harnesses and removes homes. `openFcpWs(port, token, headers?)` connects
`ws://127.0.0.1:<port>/fcp?token=<token>`. `waitWsClose` resolves the close
code. `settle(engine, runId, ms = 20_000)` polls `engine.fold` every 20 ms
until not running/queued.

## Tests (vitest) — edge cases they pin

- `/health` 200 `{ok:true, version:"0.0.1"}`; `/api/nope` 404.
- `/` exposes token for loopback Host; `Host: evil.example:<port>` → 403.
- `/fcp/bootstrap`: loopback Host+Origin 200; rebinding Host 403;
  `Host: 127.0.0.1:5173` allowed; evil Origin 403.
- `/fcp`: wrong token, rebinding Host, evil Origin → close 4401; Origin
  `http://127.0.0.1:5173` and `PW_WEB_PORT=5279` origin accepted;
  initialize returns `workspace.home` and the `blobs.http` capability;
  `ping` → `{ok:true}`.
- Blobs: PUT without / with wrong token rejected; PUT→GET round-trips
  bytes; GET unknown → 404.
- Run commands: idempotent `requestKey`, `step_state` and `run_finished`
  emitted, cancel of a live run; queueing with `maxConcurrentRuns`
  (queued run gets `run_activated`; cancelled queued run never activates);
  retry_step; resume after host restart without re-running finished
  steps; partial `only`; cardId recorded on `run_started` and summary;
  fail-then-skip chain ends the run.
- Workflow writes emit updates; delete with live run → `busy`; node trash,
  rename moves folders, stale `baseHash` conflict, old-key file
  validation error, invalid file not written.
- Inbox approval answer clears item; ACP permission answer reaches fake
  agent; `answerAcpAsk` false when nothing parked.
- Library, skills list/get/uninstall over FCP.
