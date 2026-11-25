# `@workspace/adapters-node` — port adapters (top-level `src/*.ts`)

Part of [adapters-node.md](adapters-node.md). Covers every non-host module
directly under `packages/adapters-node/src/`: the Node implementations of
the core ports, the process runner and sandbox, `engine.lock`, the gateway
unix socket, MCP connector sessions, MCP trust, CLI status, connector
transports, Chrome browser sign-in and the stdio MCP fixture.

Core port types come from `@workspace/core/ports` (or `@workspace/core`).

## event-store.ts — SQLite `EventStore`

Uses the built-in `node:sqlite` `DatabaseSync` (no npm SQLite dependency).

DDL (run by `openNodeEventStore` via `db.exec`):

```sql
CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_run_id ON events (run_id);
```

`seq` is a single global sequence across all runs. `payload` is the full
event JSON (`JSON.stringify(event)` after `engineEventSchema.parse`);
`type` and `at` duplicate event fields for querying.

```ts
export function openNodeEventStore(db: DatabaseSync): EventStore
export type NodeEventStore = EventStore & { close(): void }
export function createNodeEventStore(options: {
  dbPath: string
}): NodeEventStore
```

Port contract (`@workspace/core/ports`): `StoredEvent = { seq, event }`,
`EventAppendOptions = { expectSeq }`, `EventAppendResult = { ok: true; lastSeq; appended: StoredEvent[] } | { ok: false; kind: "conflict"; lastSeq }`.

| Method                                 | SQL / behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `append(runId, events, { expectSeq })` | `BEGIN`. `current = SELECT MAX(seq) AS seq FROM events WHERE run_id = ?` (null → 0). If `current !== expectSeq`: `ROLLBACK`, return `{ ok: false, kind: "conflict", lastSeq: current }`. Empty `events`: `COMMIT`, `{ ok: true, lastSeq: current, appended: [] }`. Else for each event: `engineEventSchema.parse` (throws on invalid), require `event.runId === runId` else throw `Error("event runId <x> !== <runId>")`, `INSERT INTO events (run_id, type, at, payload) VALUES (?, ?, ?, ?)`, read `SELECT last_insert_rowid() AS seq`. `COMMIT`; `lastSeq` = last appended seq. Any throw → `ROLLBACK` and rethrow. |
| `read(runId, fromSeq = 0)`             | `SELECT seq, payload FROM events WHERE run_id = ? AND seq >= ? ORDER BY seq ASC`. Each payload is `JSON.parse` + `engineEventSchema.safeParse`; rows that fail are silently skipped (old schema rows).                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tail()`                               | `SELECT MAX(seq) AS seq FROM events` (null → 0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

`seq` values may arrive as `bigint`; always converted with `Number()`.
`createNodeEventStore` creates the parent directory (`mkdir -p`), opens the
DB, and `close()` closes it. The `expectSeq` per run is the last global
`seq` belonging to that run (not a per-run counter).

## document-store.ts — fs `DocumentStore`

```ts
export function createNodeDocumentStore(options?: {
  root?: string
}): DocumentStore
```

Port types: `DocumentRead = { text, hash }`,
`DocumentWriteResult = { ok: true; text; hash } | { ok: false; kind: "conflict"; text; hash }`,
`DocumentRemoveResult = { ok: true } | { ok: false; kind: "not_found" }`,
`DocumentWriteOptions = { baseHash?: string }`.

- Hash: lowercase hex SHA-256 of the UTF-8 text (must equal core
  `hashUtf8Text`; pinned by `hash-parity.test.ts` for `""`,
  `"hello\nworld"`, `"yaml: true\n"`).
- Path mapping with `root`: store paths are `/`-rooted; on disk
  `join(root, path without leading "/")`. Without `root`, paths are used as
  absolute file paths.
- `read(path)`: missing → `null`; else `{ text, hash }` (utf8).
- `write(path, text, { baseHash }?)`: disk text = file content or `""` if
  missing. If `baseHash` given and differs from the disk hash →
  `{ ok: false, kind: "conflict", text: disk, hash: diskHash }` (no write).
  Otherwise atomic write and `{ ok: true, text, hash }`. Note a missing file
  has the hash of `""`.
- Atomic write: `mkdir -p dirname`; temp file
  `<dir>/.<Date.now()>-<8 hex>.tmp`; `writeFileSync` utf8; `renameSync`.
- `list(glob)`:
  - With `root`: if root missing → `[]`. Recursively walk all regular files
    (directories recursed; symlinks and other types ignored), convert to
    `/rel/posix/path`, keep those where `minimatch(pathWithoutLeadingSlash,
globWithoutLeadingSlash)`; sort with `localeCompare`.
  - Without `root`: normalise backslashes; prefix = text before the first
    `*`, `?` or `{` with trailing `/` removed (or `dirname(glob)` when no
    wildcard). Walk root = prefix if it exists, else `dirname(prefix)`;
    nothing to walk → `[]`. Match absolute paths with minimatch; sort.
- `remove(path)`: missing → `{ ok: false, kind: "not_found" }`; else
  `unlinkSync`, `{ ok: true }`.

Dependency: `minimatch` `^11.0.9` (default options).

## blob-store.ts — fs `BlobStore`

```ts
export function createNodeBlobStore(options: { root: string }): BlobStore
```

Layout under `root` (the host uses `<home>/blobs`):

```
<root>/meta/<id>.json   {"id","scope","name","mime","size"}  (compact JSON)
<root>/data/<id>        raw bytes
```

Both dirs are created eagerly (`mkdir -p`) at construction.

- `put(scope, stream, meta?)`: empty `scope` → `Error("blob scope required")`.
  `id = "b_" + 32 hex chars` (`randomBytes(16)`). Stream (web
  `ReadableStream`) is piped to `<data>.<8 hex>.tmp`, size read with
  `statSync`, renamed to `data/<id>`; on error the temp is unlinked
  (ignored) and the error rethrown. `name = meta.name ?? id`,
  `mime = meta.mime ?? "application/octet-stream"`. Writes the meta file
  and returns `{ id, name, size, mime }`.
- `open(id)`: returns `null` when `id` is empty, contains `/` or `..`, or
  either file is missing; else a web `ReadableStream` of the data file. The
  scope is not checked.

## secrets.ts — fs `SecretStore`

```ts
export function createNodeSecretStore(options: { root: string }): SecretStore
```

Host root is `<home>/secrets`. Key = relative path (e.g.
`<connectorId>/token`, `<connectionId>/cookies.json`).

- Key validation: core `assertSecretKey(key)` throws
  `Error("invalid secret key: <key>")` for keys with NUL, a leading `/` or
  `\`, a Windows drive prefix, or any empty or `..` segment (split on `/` or
  `\`). Additionally `relative(root, join(root,key))` must not start with
  `..` or be absolute (same message).
- `get(key)`: missing → `null`; else utf8 content.
- `set(key, value)`: `mkdir -p root`, `chmod root 0700`; `mkdir -p` the
  key's dir and `chmod 0700` it; write `.<Date.now()>-<8 hex>.tmp` with mode
  `0600`, rename, `chmod 0600` the file.
- `delete(key)`: unlink if it exists.

## file-watcher.ts — fs `FileWatcher`

```ts
export function createNodeFileWatcher(options: {
  root: string
  debounceMs?: number
}): FileWatcher
```

Port: `watch(globs, onChange: ({ path }) => void): Disposable`.
Default debounce `50` ms.

- One `fs.watch(root, { recursive: true })` shared by all listeners; started
  on the first `watch`, closed (and all timers cleared) when the last
  listener is disposed.
- Event filename handling: ignore empty; backslashes → `/`; if it starts
  with the root string strip it and a leading `/`; ignore empty or equal to
  `basename(root)`; ignore paths that resolve outside root. Store path is
  `/` + posix relative path.
- Debounce is per path: each event resets that path's timer; on fire, emit
  `{ path }` to every listener whose globs match (`minimatch` on the path
  and the glob, both without a leading `/`). The event type
  (rename/change) is not reported.

## pid.ts

```ts
export function isPidAlive(pid: number): boolean // process.kill(pid, 0); any throw → false
export function killProcessGroup(
  pid: number,
  signal: NodeJS.Signals = "SIGTERM"
): void
export function waitForPid(pid: number, intervalMs = 50): Promise<void>
```

- `killProcessGroup`: `process.kill(-pid, signal)`; on failure
  `process.kill(pid, signal)`; on failure ignore.
- `waitForPid`: checks immediately, then every `intervalMs` until not alive.
- Note: unlike `engine-lock.ts`'s private check, this `isPidAlive` treats
  `EPERM` as dead.

## process-runner.ts — `ProcessRunner`

```ts
export function createNodeProcessRunner(): ProcessRunner
```

`spawn(spec, signal)` with `ProcessSpawnSpec = { command, args?, cwd?, env?, sandbox?: { workflowRoot, allowCursorHome?, writeRoot? } }`:

1. If `spec.sandbox` is set: `buildSandboxArgv(command, args, sandbox.workflowRoot, { allowCursorHome, writeRoot? })` replaces command/args and sets `sandboxed` (false when sandbox-exec is unavailable).
2. `child_process.spawn(command, args, { cwd, env: spec.env (passed as-is; undefined → inherit), detached: true, stdio: ["pipe","pipe","pipe"] })`. `detached: true` puts the child in its own process group.
3. Exit promise attached before any check: on abort (or already aborted) → `killProcessGroup(child.pid)` (SIGTERM to `-pid`). `exit` event → `1` if killed by a signal, else `code ?? 1`. `error` event (e.g. ENOENT) rejects, which is caught to `1`.
4. `child.pid === undefined` → throw `Error("failed to spawn process: <command>")`. Missing stdio → `Error("spawn did not provide stdio pipes")`.
5. Returns `{ pid, stdin: Writable.toWeb, stdout/stderr: Readable.toWeb, exit, sandboxed }`.

## sandbox.ts — macOS seatbelt

Constants (exact text, each line ends with `\n`):

```
SANDBOX_PROFILE =
(version 1)
(allow default)
(deny file-write*)
(allow file-write* (subpath (param "WF_DIR")))
(allow file-write-data (literal "/dev/null"))
(allow file-ioctl (literal "/dev/null"))
(deny file-read* (subpath (param "SECRETS_DIR")))

SANDBOX_PROFILE_WITH_CURSOR = SANDBOX_PROFILE + "\n(allow file-write* (subpath (param \"CURSOR_HOME\")))\n"
```

(i.e. the Cursor variant is the base text, an empty line, then the extra
rule.) Binary: `/usr/bin/sandbox-exec`.

| Export                                                        | Behaviour                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canApplySandbox()`                                           | `false` when `process.env.FLOWAPP_SANDBOX === "0"`; else `platform() === "darwin" && existsSync("/usr/bin/sandbox-exec")`                                                                                                                                                                                                                                                                               |
| `sandboxWriteRoot(workflowRoot)`                              | `realpathSync(workflowRoot)` (throws if missing)                                                                                                                                                                                                                                                                                                                                                        |
| `sandboxSecretsRoot(workflowRoot)`                            | `home = dirname(dirname(workflowRoot))` (workflows live at `<home>/workflows/<id>`), `mkdir -p <home>/secrets`, return its realpath                                                                                                                                                                                                                                                                     |
| `type SandboxSpawn`                                           | `{ sandboxed: true \| false; command; args: string[] }`                                                                                                                                                                                                                                                                                                                                                 |
| `type SandboxSpawnOptions`                                    | `{ allowCursorHome?: boolean; writeRoot?: string }`                                                                                                                                                                                                                                                                                                                                                     |
| `buildSandboxArgv(command, args, workflowRoot, options = {})` | Not applicable → `{ sandboxed: false, command, args: copy }`. Else `command = "/usr/bin/sandbox-exec"`, args: `-p <profile> -D WF_DIR=<realpath(writeRoot ?? workflowRoot)> -D SECRETS_DIR=<secrets realpath>`, then when `allowCursorHome`: `mkdir -p ~/.cursor`, `-D CURSOR_HOME=<realpath(~/.cursor)>`; then the original `command` and `args`. Profile is the Cursor variant iff `allowCursorHome`. |
| `buildSandboxSpawn(shellCommand, workflowRoot, options = {})` | `buildSandboxArgv("/bin/sh", ["-c", shellCommand], workflowRoot, options)`                                                                                                                                                                                                                                                                                                                              |

Note the secrets root is always derived from `workflowRoot`, never from
`writeRoot`.

## runner.ts — shell task launch

```ts
export type LaunchResult = {
  pid: number
  attemptRoot: string
  sandboxed: boolean
  exit: Promise<number>
}
export function wrapCommandWithExitCode(run: string, codePath: string): string
export function spawnWrapped(
  shellCommand,
  cwd,
  env: NodeJS.ProcessEnv,
  attemptRoot,
  codePath,
  workflowRoot,
  allowCursorHome = false,
  writeRoot?: string,
  runner: ProcessRunner = createNodeProcessRunner()
): LaunchResult
```

- `wrapCommandWithExitCode`: joins with `\n` the four lines
  `<run>`, `__flow_code=$?`, `printf '%s' "$__flow_code" > '<codePath>'`,
  `exit "$__flow_code"`, where `'` in `codePath` is escaped as `'\''`.
- `spawnWrapped`: spawns `/bin/sh -c <wrapped>` with `cwd`, `env`, and
  `sandbox: { workflowRoot, allowCursorHome, writeRoot? }` and a never-aborted
  signal. Pipes stdout to `<attemptRoot>/stdout.log` and stderr to
  `<attemptRoot>/stderr.log` (append mode `a`, errors ignored), closes
  stdin, returns `{ pid, attemptRoot, sandboxed, exit }`. The exit code file
  (`codePath`) lets resume read the result after re-attaching by pid
  (DES-003).

## engine-lock.ts — single engine per home (DES-039)

File: `<home>/engine.lock`, mode `0600`, body (compact JSON, no newline):

```json
{ "pid": 12345, "url": "ws://127.0.0.1:8787/fcp", "token": "<secret>" }
```

Schema: `pid` positive int, `url` non-empty string, `token` non-empty string.

```ts
export type EngineLockSelf = { url: string; token: string }
export type AcquireLockResult =
  { owned: true } | { attachTo: { url: string; token: string; pid: number } }
export type PeekLockResult = { url: string; token: string; pid: number }
export function acquireLock(
  home: string,
  self: EngineLockSelf
): AcquireLockResult
export function peekLock(home: string): PeekLockResult | null
export function liveOwner(home: string): { url: string; token: string } | null
export function releaseLock(home: string): void
```

- Liveness (private): positive integer pid and `process.kill(pid, 0)`
  succeeds, or throws with code `EPERM` (counts as alive).
- `readLock`: parse JSON + schema; any failure → `null` (corrupt).
- `acquireLock`: `mkdir -p home`. Up to **8** attempts: open with
  `O_WRONLY | O_CREAT | O_EXCL`, mode `0o600`, write the body with
  `process.pid`, close, `chmod 0600` → `{ owned: true }`. On `EEXIST`: read;
  live owner → `{ attachTo: { url, token, pid } }` (lock untouched);
  stale/corrupt → unlink (ENOENT ignored) and retry. Other open errors
  propagate. After 8 failures: `Error("could not acquire engine.lock under <home>")`.
  If the current process already owns the lock, a second call returns
  `attachTo` with its own pid.
- `peekLock`: missing file, corrupt, or dead pid → `null`; never modifies.
- `liveOwner`: `peekLock` without `pid`.
- `releaseLock`: missing → no-op. Removes the file if it is corrupt or its
  pid equals `process.pid`; leaves another pid's lock alone.

## gateway-socket.ts — engine side of `mcp-gateway`

```ts
export function createNodeGatewaySocketServer(): GatewaySocketServer
```

Core port (`@workspace/core`): `GATEWAY_CALL_METHOD = "gateway/call"`,
`GatewaySocketListenOpts = { path; token; onCall(call: { name, arguments }, signal) => Promise<{ content: {type:"text",text}[]; isError? }> }`,
`GatewaySocketHandle = { path; close(): Promise<void> }`.

`listen(opts)`:

1. Unlink `opts.path` if present (ENOENT ignored; other errors throw).
2. `net.createServer`; every connection gets `ndjsonTransport(socket, socket)`
   - `RpcPeer` with a `gateway/call` handler:
   * params not an object → JSON-RPC error `-32602` `"gateway/call requires an object"`.
   * `name` not a non-empty string → `-32602` `"gateway/call requires name"`.
   * `token` not a non-empty string → `-32602` `"gateway/call requires token"`.
   * `arguments` → plain object or `{}`.
   * `token !== opts.token` → `-32602` `"unknown step token"` with
     `data: { code: "policy_denied" }`.
   * else `return opts.onCall({ name, arguments }, ctx.signal)` (the
     request's cancellation signal).
3. `server.listen(path)`; listen errors reject.
4. `close()`: close all peers, destroy sockets, `server.close`, unlink the path.

One server per step: each has its own token and socket path (the path
convention is chosen by core's gateway bridge).

## mcp-session.ts — connector MCP client (`McpConnect`)

```ts
export const MCP_PROTOCOL_VERSION = "2024-11-05"
export type NodeMcpConnectOptions = {
  runner: ProcessRunner
  secrets?: SecretStore
  fetch?: typeof fetch
}
export function createNodeMcpConnect(options: NodeMcpConnectOptions): McpConnect
```

`McpConnect = (connector: ConnectorFile, signal) => Promise<McpSession>`;
`McpSession = { listTools(): Promise<{name, description?}[]>; callTool(name, args): Promise<unknown>; close(): void }`.

`how = connector.how.trim()`. If it matches `/^https?:\/\//i` → HTTP
session, else stdio session.

Stdio:

- Split `how` on whitespace (no quoting); empty → `Error("MCP command is empty")`.
- Child `AbortController` mirrors the parent signal.
- `runner.spawn({ command, args }, child.signal)` (no cwd, env, sandbox).
- ndjson `RpcPeer` over stdout/stdin. Handshake: request `initialize`
  `{ protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "flows-connector", version: "0.0.0" } }`,
  then notification `notifications/initialized` (no params). Handshake
  failure closes the peer, aborts the child, rethrows.
- `listTools` → request `tools/list` `{}`; `callTool(name, args)` → request
  `tools/call` `{ name, arguments: args }` (raw result returned).
- `close()` removes the abort listener, closes the peer, aborts the child
  (kills its group).

HTTP:

- Headers `content-type: application/json`, `accept: application/json`.
- When `connector.auth` is `"pat"` or `"oauth"`: token =
  `secrets.get(tokenSecretKey(connector.id))` (key `<id>/token`); missing →
  `Error("not signed in")`; header `authorization: Bearer <token>`.
- Each call: `POST url` body `{ jsonrpc: "2.0", id: n (from 1), method, params? }`
  with the session's `signal`. Non-2xx → `Error("mcp http <status>")`.
  Body JSON with `error` → `Error(error.message ?? "mcp error")`; else
  `result`. No `notifications/initialized` is sent. `close()` is a no-op.
- Same `initialize` params as stdio.

`parseTools`: non-array → `[]`; keep entries with a non-empty string `name`;
include `description` only when a string.

## mcp-transport.ts / cli-transport.ts / api-transport.ts

Thin wiring of core connector transports (`ConnectorTransportHandler`):

| Function                                                          | Wiring                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `createNodeMcpTransport(options: { secrets?, fetch? } = {})`      | `createMcpTransport({ connect: createNodeMcpConnect({ runner: createNodeProcessRunner(), secrets, fetch }) })` |
| `createNodeCliTransport()`                                        | `createCliTransport(createNodeProcessRunner())`                                                                |
| `createNodeApiTransport({ home, onUnauthorized?, fetch?, now? })` | `createApiTransport({ secrets: createNodeSecretStore({ root: <home>/secrets }), onUnauthorized, fetch, now })` |

Types exported: `NodeMcpTransportOptions`, `NodeApiTransportOptions`.
Behaviour (capability gating, cookie jar / bearer headers, 401 → expired)
lives in core; tests pin: API transport sends the cookie jar from
`secrets/<id>/cookies.json` and marks expired on 401, sends Bearer from
`<id>/token` for `pat`; CLI transport runs an allowed capability through a
stub binary; MCP transport lists tools as capabilities, calls allowed tools,
refuses disabled ones with `policy_denied`.

## mcp-trust.ts — MCP server allow list (`McpTrustPort`)

File: `<home>/mcp-trust.json`:

```json
{
  "servers": [{ "key": "<command line or URL>", "trustedAt": "<ISO>" }]
}
```

(`JSON.stringify(value, null, 2)`, no trailing newline.)

| Export                            | Behaviour                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeMcpServerKey(key)`      | `key.trim()`                                                                                                                           |
| `listAllowedMcpServers(home)`     | read file (missing or invalid → `{ servers: [] }`), copy, sort by `key` (`localeCompare`)                                              |
| `allowMcpServerOnce(key)`         | add normalised key to a module-level in-memory set (process lifetime)                                                                  |
| `allowMcpServerAlways(home, key)` | empty key → no-op; drop from once-set; replace any entry with the same key by `{ key, trustedAt: now ISO }` appended at the end; write |
| `revokeMcpServer(home, key)`      | drop from once-set; remove entry; write                                                                                                |
| `clearMcpOnceGrants()`            | clear the once-set (tests)                                                                                                             |
| `createNodeMcpTrustPort(home)`    | `{ listServers: () => list, setGrant(key, grant) }` where `grant` `"always"` / `"once"` / other (revoke); returns the new list         |

Write: `mkdir -p home`. Empty list → write `{"servers": []}` (pretty)
directly. Otherwise write `<path>.<pid>.tmp` then rename.

There is a second, independent copy of this logic in
`host/mcp/trust.ts` (its own once-set; adds `isMcpServerAllowed` and
`mcpServerKeyFromScope`), used by the Confluence connector. Both read and
write the same file.

## cli-status.ts — agent CLI probe (`CliStatusPort`)

```ts
export function createNodeCliStatusPort(): CliStatusPort
```

`listCliStatus()` runs in parallel:

| id       | binary   | args        |
| -------- | -------- | ----------- |
| `claude` | `claude` | `--version` |
| `cursor` | `agent`  | `--version` |

Each via `execFile` with `timeout: 5000` ms, utf8. Version = first line of
`(stdout + stderr).trim()`, trimmed; any failure or empty → `null`. Result
rows: `{ id, installed: Boolean(version), version }`.

## chrome-browser-sign-in.ts (subpath export `./chrome-browser-sign-in`)

```ts
export function createChromeBrowserSignIn(options: {
  home: string
}): ChromeBrowserSignIn
// ChromeBrowserSignIn = (req: { connectorId, url, cookieDomains: string[] }, signal?) => Promise<{ cancelled: true } | { cookies: StoredCookie[] }>
```

Separate entry so `playwright-core` (`^1.65.1`) is only loaded by callers
that need it (server `fcp-connectors.ts`).

1. Already aborted → `{ cancelled: true }`.
2. Profile dir `<home>/secrets/<connectorId>/profile`: `mkdir -p`, then
   `chmod 0700` on `<home>/secrets`, `<home>/secrets/<connectorId>` and the
   profile dir.
3. `chromium.launchPersistentContext(profileDir, { channel: "chrome", headless: false, viewport: null })`.
   Failure → `Error("Chrome is not installed or could not be launched (<detail>)", { cause })`.
4. Abort listener closes the context.
5. Use the first page or open one; `goto(req.url, { waitUntil: "domcontentloaded" })`
   (errors ignored).
6. Loop while `context.browser()?.isConnected()`: abort → `{ cancelled: true }`;
   snapshot `context.cookies()` (failure breaks the loop); sleep **400 ms**.
   The user signs in and closes the window to finish. (For a persistent
   context `browser()` may be null, in which case the loop is skipped.)
7. `finally`: remove listener, close context (errors ignored).
8. Aborted → `{ cancelled: true }`. Else keep the last snapshot's cookies
   whose domain matches any `cookieDomains` entry: both stripped of a
   leading `.`, lower-cased, match when equal, or either is a dot-suffix of
   the other. Map to `{ name, value, domain, path: path || "/", expires, httpOnly, secure, sameSite? }`
   (`sameSite` only `Strict`/`Lax`/`None`). Returns `{ cookies }` (not
   persisted here; the caller writes them).

## stub-mcp-server.mjs (test fixture)

`#!/usr/bin/env node` stdio MCP server, ndjson via `readline`:

- `initialize` → `{ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "stub-mcp", version: "0.0.0" } }`.
- `notifications/initialized` ignored.
- `tools/list` → tools `echo` (`"Echo arguments as text"`, schema with
  `message: string`) and `fail` (`"Always errors"`).
- `tools/call echo` → `{ content: [{ type: "text", text: args.message (string) ?? "echo" }] }`;
  `fail` → `{ content: [{ type: "text", text: "boom" }], isError: true }`;
  other tool → error `-32000` `"unknown tool <name>"`.
- Other methods with numeric id → error `-32000` `"unknown method <m>"`.
  Blank or unparseable lines ignored.
