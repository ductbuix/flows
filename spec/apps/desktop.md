# `desktop` — Electron shell

Path: `apps/desktop`. Electron main process + sandboxed preload + an
Electron `utilityProcess` that hosts the engine (same `server/fcp-host`
stack as the daemon and CLI). The renderer is the `apps/web` production
build loaded from disk. The renderer talks FCP over a `MessagePort`:

- **own** mode: no live lock owner → main forks the utility host; each
  renderer port is transferred to it.
- **attach** mode: a live `ws://` daemon owns `engine.lock` → main bridges
  each renderer port to the daemon WebSocket (with the lock token).
- **busy**: a non-ws owner (CLI in-process, another desktop) holds the
  lock → startup throws.

Blobs are served to the renderer by the custom protocol `flows-blob://{id}`
straight from `$FLOWAPP_HOME/blobs` (both modes).

## package.json

```json
{
  "name": "desktop",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "main": "./dist/main.cjs",
  "scripts": {
    "build": "node scripts/build.mjs",
    "build:web": "FLOWAPP_DESKTOP_BUILD=1 pnpm --filter web exec vite build",
    "start": "electron .",
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run",
    "test:smoke": "pnpm run build && pnpm run build:web && playwright test"
  },
  "dependencies": {
    "@workspace/adapters-node": "workspace:*",
    "@workspace/contracts": "workspace:*",
    "@workspace/core": "workspace:*",
    "@workspace/protocol": "workspace:*",
    "@workspace/sdk": "workspace:*",
    "server": "workspace:*",
    "ws": "^8.23.0"
  },
  "devDependencies": {
    "@electron/fuses": "^2.1.3",
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.65.1",
    "@types/node": "^26.6.6",
    "@types/ws": "^8.18.2",
    "electron": "^45.4.1",
    "esbuild": "^0.28.1",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "playwright": "^1.65.1",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1"
  }
}
```

`FLOWAPP_DESKTOP_BUILD=1` is read by the web Vite config (web spec): it sets
`base: "./"` so the build loads from `file://` (the app uses hash routing
there). No
electron-builder / packaging config exists; `scripts/set-fuses.mjs` is for
a packaged app produced elsewhere.

## .gitignore

`dist/`, `smoke-results/`, `test-results/`, `playwright-report/`, `.turbo/`.
(`smoke-results/.last-run.json` exists in the tree as a Playwright artefact:
`{"status":"passed","failedTests":[]}`.)

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "moduleResolution": "bundler"
  },
  "include": [
    "src",
    "scripts",
    "smoke",
    "vitest.config.ts",
    "playwright.config.ts"
  ]
}
```

## vitest.config.ts

`defineConfig({ test: { include: ["src/**/*.test.ts"] } })` (smoke specs
are Playwright, not vitest).

## eslint.config.js

Same as the server config (`globalIgnores(["dist"])`, `noCycleBlock`,
`globals.node`, `max-lines` warn 200 / tests 300 for
`**/*.test.{ts,tsx}` and `**/*.spec.{ts,tsx}`) except the recommended
block targets `**/*.{ts,tsx,mjs}`.

## Files

```
src/
  main.ts                  Electron main: scheme, window, engine mode, IPC, lifecycle
  preload.ts               contextBridge `window.flowsDesktop`
  engine-host.ts           utilityProcess entry: lock + composeDesktopEngine + parentPort
  compose-engine.ts        composeDesktopEngine(home): createHost + FCP host, bind ports
  fcp-bridge.ts            bridgePortToWebSocket(port, url, token) for attach mode
  resolve-engine-mode.ts   resolveEngineMode(home): own | attach | busy
  flows-blob-protocol.ts   FLOWS_BLOB_* constants, parseFlowsBlobId, flowsBlobResponse
  install-flows-blob.ts    registerFlowsBlobScheme(), installFlowsBlobProtocol(home)
  window-guards.ts         isAllowedNavigation, lockDownWindow, denyAllPermissions
  host-shell.ts            Finder reveal with injectable shell (+ env stub)
  host-notifications.ts    notifyInboxIfUnfocused, notifySystem
  host-browser-sign-in.ts  partitioned sign-in window -> filtered cookies
  *.test.ts                vitest unit tests
scripts/
  build.mjs                esbuild: dist/main.cjs, dist/engine-host.cjs, dist/preload.cjs
  playwright-stub.cjs      stub for playwright/playwright-core in engine-host bundle
  set-fuses.mjs            flip Electron fuses on a packaged app
smoke/
  desktop.spec.ts          Playwright Electron smoke (own, attach, reveal)
  attach-daemon.ts         minimal ws FCP host holding engine.lock
fixtures/home/             FLOWAPP_HOME fixture copied per smoke run
playwright.config.ts       smoke config + materializeSmokeHome/removeSmokeHome
vitest.config.ts
```

## Build (`scripts/build.mjs`)

esbuild, `mkdir -p dist`, three builds in parallel with shared options
`{ bundle: true, platform: "node", target: "node20", sourcemap: true }`:

| Entry                | Out                    | Format | external         | Extra                                                                                                                                        |
| -------------------- | ---------------------- | ------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`        | `dist/main.cjs`        | cjs    | `electron`, `ws` | `banner.js = 'var __import_meta_url = require("url").pathToFileURL(__filename).href;'`, `define: { "import.meta.url": "__import_meta_url" }` |
| `src/engine-host.ts` | `dist/engine-host.cjs` | cjs    | `electron`, `ws` | `alias: { playwright, "playwright-core" → scripts/playwright-stub.cjs }`                                                                     |
| `src/preload.ts`     | `dist/preload.cjs`     | cjs    | `electron`       | —                                                                                                                                            |

CJS is used because adapters-node / `yaml` use `require("process")`.
Prints `desktop: built dist/main.cjs, dist/engine-host.cjs, dist/preload.cjs`.
`ws` stays external (resolved from `node_modules` at runtime).

`playwright-stub.cjs` exports `{ chromium: { launchPersistentContext() {
return Promise.reject(new Error("playwright-core is not available in the
desktop host")) } } }` so Chrome cookie sign-in in the utility host fails
cleanly instead of bundling Chromium (desktop sign-in goes through the
`host/browser_sign_in` client request instead).

`set-fuses.mjs <path>`: no arg → stderr
`usage: set-fuses.mjs <path to packaged Electron app/binary>`, exit 1.
Else `flipFuses(target, { version: V1, RunAsNode: false,
EnableNodeOptionsEnvironmentVariable: false,
EnableNodeCliInspectArguments: false, EnableCookieEncryption: true,
EnableEmbeddedAsarIntegrityValidation: true, OnlyLoadAppFromAsar: true,
GrantFileProtocolExtraPrivileges: false })`, log `fuses set on <target>`.

## Environment variables

| Var                   | Where                                                      | Effect                                                                       |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `FLOWAPP_HOME`        | `resolveAppHome()` (adapters-node) in main and engine-host | Home; default `~/.flowapp`. Main also passes it explicitly to the child env. |
| `FLOWAPP_WEB_DIST`    | main                                                       | Web build dir; default `<dist>/../../web/dist` (i.e. `apps/web/dist`).       |
| `FLOWAPP_REVEAL_STUB` | host-shell                                                 | If set, reveal appends `<path>\n` to this file instead of opening Finder.    |

## Main process (`src/main.ts`)

Paths: `here = dirname(fileURLToPath(import.meta.url))` (= `dist/`),
`preloadPath = here/preload.cjs`, `engineHostPath = here/engine-host.cjs`.

Module load: `registerFlowsBlobScheme()` (must run before `ready`).

`app.whenReady()`:

1. `home = resolveAppHome()`.
2. `denyAllPermissions(session.defaultSession)`.
3. `installFlowsBlobProtocol(home)`.
4. `engineMode = resolveEngineMode(home)`; `busy` → throw
   `FLOWAPP_HOME engine busy, pid <pid>`; `own` → `engineChild =
startEngineHost()`.
5. Register IPC (below).
6. `createWindow()`.
7. `app.on("activate")`: create a window if none.

`startEngineHost()`: `utilityProcess.fork(engineHostPath, [], { env: {
...process.env, FLOWAPP_HOME: home }, serviceName: "flows-engine" })`;
on `exit` with non-zero code: `console.error("engine-host exited with code
<code>")` (no restart).

`createWindow()`: `new BrowserWindow({ width: 1280, height: 800, show:
true, webPreferences: { preload, contextIsolation: true, nodeIntegration:
false, sandbox: true } })`; `lockDownWindow(win,
pathToFileURL(<webDist>/index.html).href)`; `win.loadFile(indexPath, {
hash: "/docket" })`.

Lifecycle:

- `window-all-closed` → `app.quit()` unless `darwin`.
- `before-quit` → dispose every bridge, `engineChild?.kill()`, clear it.

### IPC channels

| Channel                 | Kind                                                | Payload                                                         | Main behavior                                                                                                                                                  |
| ----------------------- | --------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flows:connect`         | `ipcRenderer.postMessage` with one transferred port | `null`, `ports[0]`                                              | No port or no mode → ignore. `own`: `engineChild.postMessage({ type: "connect" }, [port])`. `attach`: `bridges.push(bridgePortToWebSocket(port, url, token))`. |
| `flows:reveal-path`     | `send`                                              | `path: string`                                                  | Ignore non-string / empty; `revealPathInFolder(path)`.                                                                                                         |
| `flows:notify-inbox`    | `send`                                              | `{ title: string, body: string }`                               | Ignore unless both strings; `notifyInboxIfUnfocused`.                                                                                                          |
| `flows:notify-system`   | `send`                                              | `{ title, body }`                                               | Same validation; `notifySystem`.                                                                                                                               |
| `flows:browser-sign-in` | `invoke` (handle)                                   | `{ connectorId: string, url: string, cookieDomains: string[] }` | Bad shape → `{ cancelled: true }`; else `openBrowserSignIn(params)` (rejects with `Sign-in URL must be http(s)` for non-http URLs).                            |

No path validation on reveal (main trusts the renderer; the engine resolves
paths under home before asking).

## Preload (`src/preload.ts`)

`contextBridge.exposeInMainWorld("flowsDesktop", api)`:

| Method                                                                                                          | Implementation                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connect(): void`                                                                                               | `new MessageChannel()`; `ipcRenderer.postMessage("flows:connect", null, [port2])`; `window.postMessage({ type: "flows-fcp-local-port" }, "*", [port1])`. The page listens for a `message` event with that `type` and takes `event.ports[0]`. |
| `revealPath(path: string): void`                                                                                | `ipcRenderer.send("flows:reveal-path", path)`                                                                                                                                                                                                |
| `notifyInboxItem({title, body}): void`                                                                          | `send("flows:notify-inbox", payload)`                                                                                                                                                                                                        |
| `notifySystem({title, body}): void`                                                                             | `send("flows:notify-system", payload)`                                                                                                                                                                                                       |
| `browserSignIn({connectorId, url, cookieDomains}): Promise<{cookies: HostStoredCookie[]} \| {cancelled: true}>` | `ipcRenderer.invoke("flows:browser-sign-in", params)`                                                                                                                                                                                        |

The web app (out of scope) creates its FCP client from that port with
client capabilities `host.revealPath`, `host.notifications`,
`host.browserSignIn` and answers engine `host/*` requests by calling these
methods. Each `connect()` creates a new, independent FCP session.

## Engine mode (`src/resolve-engine-mode.ts`)

`type EngineMode = {kind:"attach"; url; token} | {kind:"own"} |
{kind:"busy"; pid}`. `peekLock(home)` null (missing/corrupt/dead pid) →
`own`; owner URL matches `/^wss?:\/\//` → `attach` with its url + token;
otherwise `busy` with pid. Main decides once at startup; a daemon started
later is not noticed.

## Utility host (`src/engine-host.ts`)

Runs in the utilityProcess:

1. `home = resolveAppHome()`.
2. `acquireLock(home, { url: "flows-desktop://utility-process", token:
randomBytes(32).toString("base64url") })`; owner → `console.error(
"engine-host: FLOWAPP_HOME already owned at <url>")`, `exit(1)`.
3. `engine = composeDesktopEngine(home)`.
4. `process.parentPort` missing → `console.error("engine-host:
process.parentPort missing (not a utilityProcess)")`, `releaseLock`,
   `exit(1)`.
5. `parentPort.on("message", e => …)`: only `e.data?.type === "connect"`
   with `e.ports[0]` → `engine.bindPort(port)` (MessagePortMain used as
   `MessagePortLike`).
6. `shutdown()` (idempotent): `engine.dispose()`, `releaseLock(home)`; on
   `process` `exit`; `SIGTERM` → shutdown + `exit(0)`.

## composeDesktopEngine (`src/compose-engine.ts`)

```ts
type DesktopEngine = {
  home: string
  dispose(): void
  bindTransport(t: Transport): void
  bindPort(p: MessagePortLike): void
}
```

`engine = createHost({home})`, `host = createFcpHost(engine)` (one shared
host); `bindTransport(t)` = `bindFcpTransport(t, engine, host)` (no
`blobsHttp` → no `blobs` capability); `bindPort(p)` =
`bindTransport(messagePortTransport(p))`; `dispose` = `host.dispose()`,
`engine.close()`.

## Attach bridge (`src/fcp-bridge.ts`)

`bridgePortToWebSocket(port, url, token): { dispose }`:

- `local = messagePortTransport(port)`; socket = `new WebSocket(url with
searchParams.token = token)` from `ws` (no Origin header, which the
  daemon allows).
- Local messages before `open` are buffered in order; after `open`,
  `remote = wsTransport(socket)`, flush buffer, pipe both ways.
- `dispose` (idempotent) closes local, remote, and the socket (errors
  ignored). Triggered by local close, remote close, socket `error` or
  `close`, and by main's `before-quit`.
- No reconnect in the bridge; the renderer's sdk client sees the port
  close and reconnects by calling `connect()` again (new port, new bridge).

## flows-blob:// (`src/flows-blob-protocol.ts`, `src/install-flows-blob.ts`)

`FLOWS_BLOB_SCHEME = "flows-blob"`. Privileges (registered before ready
via `protocol.registerSchemesAsPrivileged([FLOWS_BLOB_PRIVILEGES])`):
`{ standard: true, secure: true, supportFetchAPI: true, stream: true,
bypassCSP: true, corsEnabled: true }`.

`parseFlowsBlobId(requestUrl): string | null`:

1. `new URL()` failure → null; protocol must be `flows-blob:`.
2. `fromHost = url.hostname`; `fromPath` = first segment of pathname with
   leading slashes stripped; `id = fromHost || fromPath`.
3. Null when id empty; contains `..`, `/` or `\`; pathname contains `..`;
   or host form with a non-empty first path segment (e.g.
   `flows-blob://b_a/b`).
   Examples: `flows-blob://b_abc` and `flows-blob://b_abc/` → `b_abc`;
   `flows-blob://`, `flows-blob:///`, `flows-blob://../etc`,
   `https://b_abc` → null.

`flowsBlobResponse(url, store, mime = "application/octet-stream")`: bad id
→ `Response(null, 404)`; `store.open(id)` null → 404; else `200` streaming
body with `Content-Type: <mime>`.

`installFlowsBlobProtocol(home)`: `root = <home>/blobs`, `store =
createNodeBlobStore({root})`; `protocol.handle("flows-blob", req => …)`
where mime is read from `<root>/meta/<id>.json` field `mime` (missing file,
parse error, or empty → `application/octet-stream`).

## Window guards (`src/window-guards.ts`)

- `isAllowedNavigation(target, appUrl, devOrigin?)`: unparsable → false;
  `file:` → allowed only if pathname equals the app's index pathname (hash
  changes are routing); otherwise allowed only when `devOrigin` given and
  origins match. (Main never passes `devOrigin`.)
- `lockDownWindow(win, appUrl, devOrigin?)`: `setWindowOpenHandler(() =>
({ action: "deny" }))`; `will-navigate` → `preventDefault` when not
  allowed; `will-attach-webview` → always `preventDefault`.
- `denyAllPermissions(session)`: permission request handler always
  `callback(false)`; permission check handler always `false`.

## Host services

**Reveal** (`host-shell.ts`): `HostShell = { showItemInFolder(path) }`.
Default shell: if `FLOWAPP_REVEAL_STUB` set → `appendFileSync(stub,
path + "\n")`; else `electron.shell.showItemInFolder`. Lazily created;
`setHostShell(next)` for tests; `revealPathInFolder(path)` delegates.

**Notifications** (`host-notifications.ts`):
`notifyInboxIfUnfocused({title, body})` returns early if
`BrowserWindow.getFocusedWindow()` is non-null, else `notifySystem`.
`notifySystem` returns if `!Notification.isSupported()`, else `new
Notification({title, body}).show()`.

**Browser sign-in** (`host-browser-sign-in.ts`):

- `signInPartition(connectorId) = "persist:flows-signin-<connectorId>"`.
- `cookieDomainMatches(cookieDomain, allowed)`: strip one leading `.`,
  lowercase both; match if equal, cookie is a subdomain of allowed, or
  allowed is a subdomain of cookie.
- `filterSessionCookies(cookies, domains)`: skip cookies without domain or
  not matching any allowed domain; map to `HostStoredCookie { name, value,
domain, path: path || "/", expires: expirationDate (number) or undefined,
httpOnly, secure, sameSite }` with `strict→"Strict"`, `lax→"Lax"`,
  `no_restriction→"None"`, else undefined.
- `BrowserSignInHost = { fromPartition(p): Session; openWindow({partition,
url}): Promise<{closed: Promise<void>; close(): void}> }`. Default:
  `BrowserWindow({ width: 960, height: 720, show: true, title: "Sign in",
webPreferences: { partition, contextIsolation: true, nodeIntegration:
false, sandbox: true } })`, deny window.open, `loadURL(url)`; `closed`
  resolves on `closed`; `close()` if not destroyed. `setBrowserSignInHost`
  / `getBrowserSignInHost` (lazy default).
- `openBrowserSignIn(params, signal?)`: aborted → `{cancelled: true}`;
  URL protocol not `http:`/`https:` → throw `Sign-in URL must be http(s)`;
  open window in the connector partition; abort closes it and marks
  cancelled; await `closed`; cancelled/aborted → `{cancelled: true}`; else
  `{ cookies: filterSessionCookies(await sess.cookies.get({}),
cookieDomains) }`. Closing the window is the "done" signal; there is no
  timeout. (Main does not pass a signal.)

## Smoke tests (Playwright, `smoke/`)

`playwright.config.ts`: `testDir: "smoke"`, `outputDir: "smoke-results"`,
`fullyParallel: false`, `workers: 1`, `retries: 0`, `reporter: [["list"]]`,
`timeout: 60_000`. Also exports `materializeSmokeHome()` (mkdtemp
`flowapp-desktop-smoke-*`, recursive copy of `fixtures/home`) and
`removeSmokeHome(home)`.

Fixture home (`fixtures/home`):

| File                                 | Content                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docket/board.yaml`                  | `version: 1`, columns `todo` "Todo", `doing` "Doing"                                                                                 |
| `docket/cards/alpha/card.md`         | front matter `id: alpha`, `title: Alpha card`, `status: todo`, `created`/`updated: 2026-11-20T09:12:00Z`; body `Alpha fixture body.` |
| `docket/cards/beta/card.md`          | same with `beta`, `Beta card`, `status: doing`                                                                                       |
| `blobs/data/b_smoke_card_image`      | 71-byte 1×1 PNG                                                                                                                      |
| `blobs/meta/b_smoke_card_image.json` | `{id, scope: "docket/cards/alpha/assets", name: "card.png", mime: "image/png", size: 71}`                                            |

`desktop.spec.ts` launches `electron.launch({ args: [dist/main.cjs], cwd:
apps/desktop, env: { ...process.env, FLOWAPP_HOME, FLOWAPP_WEB_DIST:
<repo>/apps/web/dist } })`:

1. **own path**: test ids `docket-page` (30 s), `docket-card-alpha` (20 s),
   `docket-card-beta`, texts "Alpha card"/"Beta card" visible;
   `fetch("flows-blob://no-such-blob")` → 404; an `<img
src="flows-blob://b_smoke_card_image">` loads with natural size > 0.
2. **attach path**: `startAttachDaemon(home)` first, then the same Docket
   checks.
3. **reveal**: with `FLOWAPP_REVEAL_STUB=<home>/reveal.log`,
   `window.flowsDesktop.revealPath("/tmp/flows-smoke-reveal")` → log
   eventually contains that path.

`smoke/attach-daemon.ts` `startAttachDaemon(home)`: token
`desktop-attach-<pid>`; `composeDesktopEngine(home)`; `http.createServer`
answering 404; `WebSocketServer({ server, path: "/fcp" })`; listen
`127.0.0.1:0`; `acquireLock(home, {url: "ws://127.0.0.1:<port>/fcp",
token})` (owner present → clean up and throw `attach-daemon: home already
owned at <url>`); on connection, query `token` mismatch → `close(4401)`,
else `engine.bindTransport(wsTransport(socket))`. `close()` closes wss,
server, disposes engine, releases lock. Returns `{url, token, port, close}`.

## Unit tests (vitest)

- `compose-engine.test.ts`: initialize + `docket/list_cards` over a
  MessagePort; `file/reveal` makes the engine call the client's
  `host/reveal_path`.
- `fcp-bridge.test.ts`: requests over the port reach a ws daemon and back.
- `flows-blob-protocol.test.ts`: id parsing cases above; 404 unknown and
  out-of-scope; streams a known blob.
- `host-browser-sign-in.test.ts`: partition name; domain filter; cookies
  returned on window close; abort → cancelled.
- `host-notifications.test.ts`: skip when focused; show when unfocused.
- `host-shell.test.ts`: delegation to injected shell.
- `resolve-engine-mode.test.ts`: no lock → own; stale pid → own; live ws
  owner → attach; live non-ws owner → busy.
- `window-guards.test.ts`: hash routing allowed in bundle; other files and
  remote origins blocked; dev origin only when given.
