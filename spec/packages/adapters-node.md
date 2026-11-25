# `@workspace/adapters-node` — Node adapters, engine lock, host composition

Path: `packages/adapters-node`. Node implementations of the
`@workspace/core` ports (SQLite event log, fs documents, blobs, secrets,
file watcher, process runner + macOS sandbox, gateway unix socket, MCP
connector sessions), the single-engine `engine.lock`, and `src/host/`: the
`Host` class plus the app-host leftovers (app db settings and notices,
trust markers, library, work copies, run input, legacy connectors).
Design: DES-002 (app home), DES-003 (runs on disk, resume), DES-006
(sandbox), DES-019 (CLI trust), DES-026 (library, connectors), DES-034
(steps), DES-039 (engine lock / layering), DES-041 (agent runtime, ports).

This spec is split:

| File                                                       | Covers                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| this file                                                  | package files, tree, exports, env vars, cross-cutting constants                                                                                                                                        |
| [adapters-node-runtime.md](adapters-node-runtime.md)       | top-level `src/*.ts`: event store, document/blob/secret stores, watcher, process runner, sandbox, runner, pid, engine lock, gateway socket, MCP sessions/trust, CLI status, transports, Chrome sign-in |
| [adapters-node-host.md](adapters-node-host.md)             | `src/host/`: on-disk layout, app db (`events`/`settings`/`notices`), `Host`, trust and Cursor markers, run fold/summary/cancel/delete, library, work copies, run input, connections                    |
| [adapters-node-connectors.md](adapters-node-connectors.md) | `src/host/connectors/`: registry, fake, github, confluence, rally                                                                                                                                      |

## package.json

```json
{
  "name": "@workspace/adapters-node",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "exports": {
    ".": "./src/index.ts",
    "./chrome-browser-sign-in": "./src/chrome-browser-sign-in.ts"
  },
  "dependencies": {
    "@workspace/contracts": "workspace:*",
    "@workspace/core": "workspace:*",
    "@workspace/protocol": "workspace:*",
    "minimatch": "^11.0.9",
    "playwright-core": "^1.65.1",
    "yaml": "^2.9.1",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^26.6.6",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1"
  }
}
```

No build; exports point at `.ts`; all internal imports use explicit `.ts`
(and `.mjs` fixtures). SQLite is the built-in `node:sqlite` (`DatabaseSync`),
so Node must provide it (Node 22.5+; repo targets current Node).
`@workspace/core` is imported both as `@workspace/core` and
`@workspace/core/ports` (and tests use `@workspace/core/testing`,
`@workspace/core/kernel/hash`).

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`DOM` lib is needed for web streams / `fetch` / `Headers` / `RequestInit`
types.

## eslint.config.js

Flat config, `defineConfig([...])`:

1. `globalIgnores(["dist"])`.
2. `**/*.ts`: extends `js.configs.recommended`, `tseslint.configs.recommended`; `globals.node`.
3. `noCycleBlock` from `../../eslint-dependency-guards.mjs`: plugin
   `eslint-plugin-import-x` registered as `import`, rule
   `import/no-cycle: ["error", { maxDepth: Infinity }]`, TS parser for
   `.ts/.tsx`, node resolver with `.js .jsx .ts .tsx`.
4. `**/*.{ts,tsx}`: `...adaptersRestrictedImports` (rule
   `no-restricted-imports` error with pattern group
   `@workspace/adapters-*`, `@workspace/agent-acp`, `@workspace/agent-acp/*`,
   `@workspace/mcp-gateway`, `@workspace/mcp-gateway/*`, message
   `"adapters must not import other adapters"`), and `max-lines` warn
   `{ max: 200, skipBlankLines: true, skipComments: true }`.
5. Tests (`**/*.test.*`, `**/*.spec.*`): `max-lines` warn at 300.

## File tree

```
src/
  index.ts                         package exports (ports + host re-exports)
  event-store.ts                   SQLite EventStore (events table)
  document-store.ts                fs DocumentStore (sha256 hashes, atomic writes, minimatch list)
  blob-store.ts                    fs BlobStore (meta/ + data/)
  secrets.ts                       fs SecretStore (0700 dirs, 0600 files)
  file-watcher.ts                  recursive fs.watch FileWatcher with per-path debounce
  pid.ts                           isPidAlive, killProcessGroup, waitForPid
  process-runner.ts                ProcessRunner (detached group, optional sandbox-exec)
  sandbox.ts                       seatbelt profiles and argv builders
  runner.ts                        spawnWrapped shell task + exit-code file
  engine-lock.ts                   engine.lock acquire/peek/release
  gateway-socket.ts                unix socket server for mcp-gateway (gateway/call)
  mcp-session.ts                   McpConnect over stdio (ProcessRunner) or HTTP
  mcp-transport.ts                 createNodeMcpTransport
  cli-transport.ts                 createNodeCliTransport
  api-transport.ts                 createNodeApiTransport
  mcp-trust.ts                     mcp-trust.json allow list + McpTrustPort
  cli-status.ts                    claude / agent --version probe
  chrome-browser-sign-in.ts        Playwright Chrome cookie sign-in (separate export)
  stub-mcp-server.mjs              stdio MCP fixture for transport tests
  host/
    index.ts                       host barrel
    host.ts                        Host class, createHost
    event-log.ts                   EventLog: app.db (events + settings + notices)
    settings.ts                    settings table, cli_trust value
    notices.ts                     notices table
    paths.ts                       FLOWAPP_HOME and path helpers
    config.ts                      config.yaml loader, effectiveLimit
    blob-store.ts                  module BlobStore singleton
    process-runner.ts              module ProcessRunner singleton
    trust.ts                       Host trust helpers
    trust-policy.ts                decideTrust, isAlwaysTrusted
    trust-marker.ts                keep/remove Cursor markers from fold
    engine-trust.ts                start grant, engine marker reconcile
    cursor-trust.ts                ~/.cursor/projects/<slug>/.workspace-trusted
    log-runs.ts                    fold runs from the log
    run-summary.ts                 summarizeRun, RunSummaryCache
    run-removal.ts                 pinNodeRun, deleteRun, finishPendingRemovals
    delete-run.ts                  run_deleted + rm run dir
    library.ts                     pullEntity, scope entity, link resources
    library-paths.ts               freshness, revision meta, current symlink
    library-list.ts                listLibrary
    library-pins.ts                pins across runs
    library-usage.ts               size cap, LibraryCapError
    library-retention.ts           sweep, clear, git gc of shared clones
    library-run.ts                 materializeNodeRunResources, pullNow
    library-run-targets.ts         Asset pull targets, pullOneTarget
    work-copy.ts                   work copies, diff, publish base
    run-input.ts                   materializeRunInput, input hash
    source-manual.ts               manual input source
    item-key.ts                    manualItemKey, cardItemKey
    secrets.ts                     cookies.json store, sign-in removal
    connection-model.ts            legacy Connection schema
    connection-resolve.ts          connectors/<id>.yaml -> Connection
    test-connections.ts            in-memory connections for tests
    mcp/client.ts                  line-delimited MCP tools/call client
    mcp/trust.ts                   MCP allow list (connector copy)
    nodes/index.ts                 barrel of node helpers
    nodes/fold-steps.ts            step fold
    nodes/run-state.ts             run fold, statuses
    nodes/step-paths.ts            step/attempt/frozen dirs
    nodes/cancel.ts                cancel run
    nodes/publish-assert.ts        publish node validation
    nodes/template-assert.ts       template name validation
    connectors/...                 see adapters-node-connectors.md
  *.test.ts, *.contract.test.ts    tests (contract tests run core port suites)
```

## index.ts exports

From the top-level modules:

| Module         | Exports                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| blob-store     | `createNodeBlobStore`                                                                                                                                                                                   |
| document-store | `createNodeDocumentStore`                                                                                                                                                                               |
| event-store    | `createNodeEventStore`, `openNodeEventStore`, `type NodeEventStore`                                                                                                                                     |
| file-watcher   | `createNodeFileWatcher`                                                                                                                                                                                 |
| process-runner | `createNodeProcessRunner`                                                                                                                                                                               |
| cli-transport  | `createNodeCliTransport`                                                                                                                                                                                |
| api-transport  | `createNodeApiTransport`, `type NodeApiTransportOptions`                                                                                                                                                |
| mcp-transport  | `createNodeMcpTransport`, `type NodeMcpTransportOptions`                                                                                                                                                |
| mcp-session    | `createNodeMcpConnect`, `MCP_PROTOCOL_VERSION`, `type NodeMcpConnectOptions`                                                                                                                            |
| pid            | `isPidAlive`, `killProcessGroup`, `waitForPid`                                                                                                                                                          |
| sandbox        | `SANDBOX_PROFILE`, `SANDBOX_PROFILE_WITH_CURSOR`, `buildSandboxArgv`, `buildSandboxSpawn`, `canApplySandbox`, `sandboxSecretsRoot`, `sandboxWriteRoot`, `type SandboxSpawn`, `type SandboxSpawnOptions` |
| runner         | `spawnWrapped`, `wrapCommandWithExitCode`, `type LaunchResult`                                                                                                                                          |
| secrets        | `createNodeSecretStore`                                                                                                                                                                                 |
| engine-lock    | `acquireLock`, `liveOwner`, `peekLock`, `releaseLock`, `type AcquireLockResult`, `type EngineLockSelf`, `type PeekLockResult`                                                                           |
| gateway-socket | `createNodeGatewaySocketServer`                                                                                                                                                                         |
| cli-status     | `createNodeCliStatusPort`                                                                                                                                                                               |
| mcp-trust      | `allowMcpServerAlways`, `allowMcpServerOnce`, `clearMcpOnceGrants`, `createNodeMcpTrustPort`, `listAllowedMcpServers`, `normalizeMcpServerKey`, `revokeMcpServer`                                       |

From `./host/index.ts` (subset): `createHost`, `Host`,
`type CreateHostOptions`, `ensureBlobStore`, `getBlobStore`,
`setBlobStore`, `getProcessRunner`, `setProcessRunner`, `workflowDir`,
`runDir`, `frozenDir`, `attemptRootOf`, `stepDir`, `stepTaskStatus`,
`type RunState`, `type ManualItem`, `type MaterializeResourcesResult`,
`type StoredEvent`, `materializeRunInput`, `recordUnpublishedLocalEffects`,
`advanceWorkCopyBase`, `diffWorkCopy`, `ensureWorkCopiesFor`,
`getConnector`, `findConnection`, `requireConnection`,
`registerBuiltinConnectors`, `registerConnector`, `fakeConnector`,
`type Connector`, `resolveAppHome`.

Everything else in `host/` is reachable only via relative imports inside
the package (the package has no `./host` export).

Subpath `@workspace/adapters-node/chrome-browser-sign-in` exports
`createChromeBrowserSignIn` only.

## Environment variables

| Variable                                                                                  | Read in                          | Effect                                                                   |
| ----------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `FLOWAPP_HOME`                                                                            | `host/paths.ts` `resolveAppHome` | app home; default `~/.flowapp`                                           |
| `FLOWAPP_SANDBOX`                                                                         | `sandbox.ts` `canApplySandbox`   | `"0"` disables sandbox-exec (tasks run unrestricted, `sandboxed: false`) |
| `FLOWAPP_CURSOR_PROJECTS`                                                                 | `host/cursor-trust.ts`           | Cursor projects dir; default `~/.cursor/projects`                        |
| `FLOWAPP_LIVE_GH`                                                                         | github tests only                | `"1"` enables live `gh` tests                                            |
| `STUB_SPACE`, `STUB_PAGE`, `STUB_TITLE`, `STUB_VERSION`, `STUB_MARKDOWN`, `STUB_CONFLICT` | `confluence/stub-mcp-server.mjs` | stub server state                                                        |

`FLOWAPP_FAKE_CONNECTOR` is documented in the connectors README but read by
the server, not by this package.

## Child processes spawned

| Where                  | Command                                                                                                                       | Notes                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `process-runner.ts`    | `spec.command spec.args` or `/usr/bin/sandbox-exec -p <profile> -D WF_DIR=… -D SECRETS_DIR=… [-D CURSOR_HOME=…] <cmd> <args>` | `detached: true`, stdio pipes, kill = SIGTERM to `-pid` |
| `runner.ts`            | `/bin/sh -c "<cmd>\n__flow_code=$?\nprintf '%s' \"$__flow_code\" > '<codePath>'\nexit \"$__flow_code\""`                      | always with sandbox spec                                |
| `mcp-session.ts`       | `how` split on whitespace                                                                                                     | via ProcessRunner, no sandbox                           |
| `host/mcp/client.ts`   | scope `command`                                                                                                               | `spawn(command, { shell: true })`                       |
| `cli-status.ts`        | `claude --version`, `agent --version`                                                                                         | `execFile`, 5 s timeout                                 |
| `library-retention.ts` | `git -C <clone> config gc.auto 0`, `git -C <clone> gc --prune=now`                                                            | errors ignored                                          |
| `work-copy.ts`         | `git -C <repo> config gc.auto 0`, `git clone --shared <src> <dest>`, `cp -cR <src> <dest>`                                    | `execFileSync`, stdio ignored                           |
| github connector       | `gh …` (15 s), `git …` (120 s, 16 MiB buffer)                                                                                 | see connectors doc                                      |
| chrome sign-in         | Playwright `chromium.launchPersistentContext` with `channel: "chrome"`                                                        | headed                                                  |

## Timeouts and constants (summary)

| Constant                                | Value                                   |
| --------------------------------------- | --------------------------------------- |
| File watcher debounce                   | 50 ms default                           |
| `waitForPid` poll                       | 50 ms default                           |
| Engine lock acquire attempts            | 8                                       |
| `EventLog.append` conflict retries      | 8                                       |
| Notices default page                    | 50                                      |
| Run summary list default limit          | 100                                     |
| CLI version probe timeout               | 5000 ms                                 |
| Chrome cookie poll                      | 400 ms                                  |
| `gh` timeout / `git` timeout            | 15 000 ms / 120 000 ms                  |
| Library retention age / sweep interval  | 7 days / 1 hour                         |
| Default library cap                     | 5 GiB (`DEFAULT_LIBRARY_MAX_BYTES`)     |
| Refresh rules                           | `15m`, `1h`, `1d`, `never`              |
| PR body cap                             | 60 000 chars                            |
| Publish receipt fingerprint             | first 16 hex of SHA-256(JSON changeset) |
| MCP protocol version (connector client) | `2024-11-05`                            |

## Tests overview

Contract tests (`*.contract.test.ts`) run the shared core port suites
against the Node blob, document, event, secret, watcher and process-runner
adapters. Other tests: `engine-lock` (O_EXCL + 0600, attach to live owner,
replace dead pid or corrupt file, peek/liveOwner do not take the lock,
release only own lock), `gateway-socket` (end to end with core
`createMcpGatewayBridge`: read call allowed and logged as
`connector_called`, bad token refused with "unknown step token", write
capability denied when connector writes are off, socket removed when the
step ends), `hash-parity`, `mcp-trust`, transport tests, and the host and
connector tests listed in the sub-documents.
