# core: connectors (service, runtime, transports, sign-in, FCP)

Part of the [`@workspace/core` spec](core.md). Covers `src/connectors/`.

A connector is a YAML file `connectors/<id>.yaml` (contracts
`ConnectorFile`: `id, name, transport: "mcp" | "api" | "cli", how, auth,
capabilities: {name, desc, write, allowed?, cmd?}[], providerId?`). Secrets
never live in the YAML; they are in `SecretStore` under
`<id>/cookies.json` and `<id>/token`. Live status (`connected | expired |
off`) is in memory only.

## Files

| File                 | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `index.ts`           | barrel                                                                     |
| `service.ts`         | `ConnectorService`: YAML CRUD + in-memory status; path helpers             |
| `capabilities.ts`    | `isCapabilityAllowed`, `setCapabilityAllowed`                              |
| `transport.ts`       | `ConnectorTransportHandler`, `ConnectorCallResult`, `ConnectorCheckResult` |
| `registry.ts`        | `ConnectorTransportRegistry` (by transport kind)                           |
| `runtime.ts`         | `ConnectorRuntime`: capability gate then transport                         |
| `cli-transport.ts`   | `createCliTransport`, `cliArgv`                                            |
| `api-auth.ts`        | secret keys, cookie parsing/matching, auth headers                         |
| `api-transport.ts`   | `createApiTransport` (fetch, same-origin, no redirects)                    |
| `mcp-session.ts`     | `McpSession`, `McpConnect`, `McpToolInfo` types                            |
| `mcp-transport.ts`   | `createMcpTransport`, `mergeListedTools`, `argsToMcpArguments`             |
| `check.ts`           | `checkConnector` (status + update + Inbox hook)                            |
| `browser-sign-in.ts` | `performBrowserSignIn`, cookie domain filters                              |
| `sign-in.ts`         | `signInConnector`, `connectorSignInTarget`                                 |
| `sign-out.ts`        | `signOutConnector`, `clearConnectorSecrets`                                |
| `bind.ts`            | `createConnectorBindings` (8 FCP methods)                                  |

Barrel exports: `isCapabilityAllowed`, `setCapabilityAllowed`,
`createConnectorBindings`, `ConnectorBindings`,
`ConnectorSignInBindingDeps`, `CreateConnectorBindingsOptions`,
`cookieDomainMatches`, `filterCookiesForDomains`, `performBrowserSignIn`,
`BrowserSignInOutcome`, `BrowserSignInRequest`, `ChromeBrowserSignIn`,
`connectorSignInTarget`, `signInConnector`, `ConnectorSignInDeps`,
`ConnectorSignInResult`, `clearConnectorSecrets`, `signOutConnector`,
`ConnectorSignOutDeps`, `checkConnector`, `ConnectorCheckDeps`,
`ConnectorCheckOutcome`, `ConnectorStatusChange`, `createCliTransport`,
`cliArgv`, `cookiesSecretKey`, `parseCookies`, `tokenSecretKey`,
`StoredCookie`, `createApiTransport`, `ApiTransportDeps`,
`argsToMcpArguments`, `createMcpTransport`, `mergeListedTools`,
`McpTransportDeps`, `McpConnect`, `McpSession`, `McpToolInfo`,
`createConnectorTransportRegistry`, `ConnectorTransportRegistry`,
`createConnectorRuntime`, `ConnectorRuntime`, `ConnectorRuntimeDeps`,
`CONNECTORS_GLOB`, `connectorIdFromPath`, `connectorPath`,
`createConnectorService`, `ConnectorService`, `ConnectorRecord`,
`ConnectorServiceDeps`, `ConnectorStatusInfo`, `ConnectorCallResult`,
`ConnectorCheckResult`, `ConnectorTransportHandler`. (`authHeaders` and
`isApiAuth` are internal.)

## ConnectorService (`service.ts`)

```ts
const CONNECTORS_GLOB = "connectors/*.yaml"
connectorPath(id) → `connectors/${id}.yaml`
connectorIdFromPath(path) → id | null   // normalizes \ and one leading /; regex ^connectors/([^/]+)\.yaml$
type ConnectorRecord = { connector: ConnectorFile; hash: string; path: string }
type ConnectorStatusInfo = { status: ConnectorStatus; checkedAt: string; detail?: string }
class ConnectorService {
  constructor(deps: { docs: DocumentStore })
  getStatus(id); setStatus(id, info)
  list(): ConnectorSummary[]
  get(id): ConnectorRecord | null
  save(connector, baseHash?): { hash } | { conflict: ConnectorRecord }
  remove(id): void
  setCapability(id, name, allowed, baseHash): { hash } | { conflict: ConnectorRecord }
}
createConnectorService(deps)
```

- `readRecord(id)` (used by `get`, `setCapability`): missing → `null`;
  invalid YAML/schema (`safeParseConnectorYaml`) → `invalid_params "Invalid
connector file: <id>"` with `data {issues: [{path}]}`; `data.id !== id` →
  `invalid_params "Connector id mismatch: file <id> declares <declared>"`.
- `list()`: every `connectors/*.yaml` path → id; unreadable files skipped
  silently; `toConnectorSummary(connector, live status?)` (status defaults to
  `off`); sorted by `id.localeCompare`.
- `save`: writes `connectorToYaml(connector)` with `baseHash`. On conflict:
  re-read; when the file is now missing throw `conflict "Stale baseHash"`,
  else return `{conflict: current}`.
- `remove`: `not_found "Connector not found: <id>"` when missing; clears the
  in-memory status.
- `setCapability`: missing → `not_found`; unknown capability →
  `invalid_params "Capability not found: <name>"`; then `save(next,
baseHash)`.

`isCapabilityAllowed(connector, name)`: the capability exists and
`allowed === true` (undefined counts as off). `setCapabilityAllowed`
returns a new connector with that capability's `allowed` replaced, or
`null` when the name is unknown.

## Runtime and registry

```ts
interface ConnectorTransportHandler {
  readonly kind: ConnectorTransport // "mcp" | "api" | "cli"
  call(
    connector,
    capability,
    args: readonly string[],
    signal
  ): Promise<ConnectorCallResult>
  check?(connector, signal): Promise<ConnectorCheckResult>
}
type ConnectorCallResult = { stdout: string; stderr: string; exitCode: number }
type ConnectorCheckResult = {
  ok: boolean
  detail?: string
  tools?: { name; description? }[]
}
class ConnectorTransportRegistry {
  register(h): this
  get(kind)
  kinds()
}
createConnectorTransportRegistry((handlers = []))
class ConnectorRuntime {
  constructor(deps: {
    connectors: ConnectorService
    transports: ConnectorTransportRegistry
  })
  call(connectorId, capability, args, signal): Promise<ConnectorCallResult>
  check(connectorId, signal): Promise<ConnectorCheckResult>
}
createConnectorRuntime(deps)
```

`call`: connector missing → `not_found "Connector not found: <id>"`;
capability missing → `not_found "Capability not found: <cap>"`; not allowed
→ `policy_denied "Capability is off: <cap>"`; no transport for the kind →
`unsupported 'No transport registered for "<kind>"'`; else
`transport.call`. `check`: same not-found / unsupported; transport without
`check` → `{ok: true}`.

## Transports

### CLI (`cli-transport.ts`)

`createCliTransport(runner: ProcessRunner)`, kind `cli`. The connector's
`how` is the binary.

- Both methods assert `transport === "cli"` (`invalid_params 'CLI transport
cannot run connector with transport "<t>"'`).
- `call`: capability `cmd` required (`invalid_params 'Capability "<name>"
has no cmd mapping'`); spawn `{command: how, args: [...cmd, ...args]}` (no
  cwd/env/sandbox), close stdin, collect stdout, stderr, exit in parallel.
- `check`: run `how --version`; `{ok: true, detail: trimmed stdout ||
trimmed stderr || undefined}` (exit code is not inspected); a throw →
  `{ok: false, detail: message}`.

`cliArgv(capability, args)`: `[...cmd, ...args]` or `null` without cmd.

### API (`api-transport.ts`, `api-auth.ts`)

```ts
type ApiTransportDeps = {
  secrets: SecretStore
  fetch?: typeof fetch
  now?: () => number // epoch ms
  onUnauthorized?: (connector, detail: string) => void
}
createApiTransport(deps) // kind "api"
```

- Assert `transport === "api"` and `auth ∈ {cookies, pat, oauth}`
  (`invalid_params` messages `API transport cannot run connector with
transport "<t>"` / `... with auth "<a>"`).
- `call`: `cmd = [method, path?]`; missing cmd → `invalid_params` "no cmd
  mapping"; method uppercased must be one of GET POST PUT PATCH DELETE HEAD
  (`invalid_params 'Capability "<name>" cmd method must be HTTP, got
"<cmd0>"'`). Path = `[cmd[1] ?? "", ...args.map(encodeURIComponent)]`,
  empty parts dropped, joined by `/`, then duplicate slashes collapsed except
  after `:`.
- URL join: `how` must parse (`invalid_params "Invalid connector base URL:
<how>"`); base = `how` minus one trailing `/`; empty path → base; an
  absolute `http(s)://` path is used as is; otherwise `base + path` (adding
  `/` when needed). Unparseable → `invalid_params "Invalid request path:
<path>"`. Origin different from the base origin → `policy_denied "Request
origin <o> differs from connector base <o>"` **before** fetch.
- Headers (`authHeaders(secrets, connector, nowMs, url)`); `null` →
  `EngineError("failed_precondition", "not signed in")`.
  - `cookies`: read `<id>/cookies.json`, `JSON.parse` +
    `parseCookies` (any failure → null). Keep cookies with no `expires` or
    `expires > now/1000`, `secure` only on `https:`, domain match (no domain:
    request host must equal the `how` host; with domain: equal or subdomain,
    leading `.` ignored, case-insensitive), RFC 6265 path match. None left →
    null. Header `Cookie: n=v; n2=v2`.
  - `pat` / `oauth`: `<id>/token` trimmed non-empty → `Authorization:
Bearer <token>`.
  - other auth → null.
- `fetch(url, {method, headers, signal, redirect: "manual"})`; body text.
  3xx → `{stdout: body, stderr: "HTTP <s>", exitCode: s}`; 401 →
  `onUnauthorized(connector, "sign-in expired")` and `{stdout: body, stderr:
"sign-in expired", exitCode: 401}`; 2xx → `{stdout: body, stderr: "",
exitCode: 0}`; else `HTTP <s>` with exitCode = status.
- `check`: `GET` of the base. exit 0 → `{ok: true, detail: trimmed body ||
undefined}`; else `{ok: false, detail: trimmed stderr || "HTTP <code>"}`;
  throws (including "not signed in") → `{ok: false, detail: message}`.

`parseCookies(raw)`: must be an array of objects with non-empty string
`name` and string `value`, else `undefined`; `path` defaults to `/`; copies
`domain` (non-empty), `expires` (number), `httpOnly`, `secure` (booleans),
`sameSite` (`Strict|Lax|None`). `cookiesSecretKey(id) = "<id>/cookies.json"`,
`tokenSecretKey(id) = "<id>/token"`.

### MCP (`mcp-session.ts`, `mcp-transport.ts`)

```ts
type McpToolInfo = { name: string; description?: string }
type McpSession = { listTools(): Promise<McpToolInfo[]>; callTool(name, args: Record<string, unknown>): Promise<unknown>; close(): void }
type McpConnect = (connector: ConnectorFile, signal: AbortSignal) => Promise<McpSession>
createMcpTransport({ connect }): ConnectorTransportHandler   // kind "mcp"
```

- Assert `transport === "mcp"` (`invalid_params`).
- `call`: open a session, `callTool(capability.name,
argsToMcpArguments(args))`, always `close()`. Result with a `content`
  array → text = each item's `text` or JSON of the item, joined by `\n`;
  `isError` → `{stdout: "", stderr: text || "tool error", exitCode: 1}`;
  else `{stdout: text, stderr: "", exitCode: 0}`. Other results → stdout =
  `JSON.stringify(result ?? null)`.
- `check`: connect + `listTools`; `{ok: true, detail: "tools: a, b" |
"tools: (none)", tools}`; any throw → `{ok: false, detail}`.

`argsToMcpArguments(args)`: one arg that parses as a JSON object → that
object; zero args → `{}`; else `{args: [...args]}`.

`mergeListedTools(connector, tools)`: capabilities become exactly the
listed tools in order; existing ones keep all fields with `desc =
description ?? old desc`; new ones `{name, desc: description ?? "", write:
false, allowed: true}`.

## Check, sign-in, sign-out

```ts
type ConnectorStatusChange = { connectorId; name; status: ConnectorStatus; at; detail? }
type ConnectorCheckDeps = { service; runtime: ConnectorRuntime; bus: UpdateBus; clock: Clock; onStatusChanged?: (c) => void }
checkConnector(deps, id, signal): Promise<{ status; detail? }>
```

`checkConnector`: missing → `not_found`. `runtime.check`; `status = ok ?
"connected" : "expired"`; `at = ISO(clock.now())`. When ok and `tools` were
returned, re-read and `save(mergeListedTools(...), fresh.hash)` (conflict
results ignored). `setStatus(id, {status, checkedAt: at, detail})`. Publish
`connector/update {kind: "status_changed", connectorId, status, checkedAt,
detail?}`. Call `onStatusChanged({connectorId, name, status, at, detail?})`
(the host feeds `InboxService.applyConnectorStatus`: expired opens a sign-in
item, connected resolves it).

Browser sign-in (`browser-sign-in.ts`):

```ts
type BrowserSignInRequest = { connectorId: string; url: string; cookieDomains: string[] }
type BrowserSignInOutcome = { cookies: HostStoredCookie[] } | { cancelled: true }
type ChromeBrowserSignIn = (req, signal?) => Promise<BrowserSignInOutcome>
performBrowserSignIn({ peer?, connection?, chromeSignIn? }, req, signal?)
cookieDomainMatches(cookieDomain, allowed): boolean
filterCookiesForDomains(cookies, cookieDomains)
```

`performBrowserSignIn`: when `connection.clientCapabilities.host.browserSignIn
=== true` → requires `peer` (`internal "Host peer missing for browser
sign-in"`), sends the FCP **server→client** request `host/browser_sign_in`
with `req` and parses the reply with `hostBrowserSignInResultSchema`. Else
`chromeSignIn(req, signal)` if given. Else `unsupported "Browser sign-in is
not available on this host"`.

`cookieDomainMatches`: lowercase, strip leading `.`; equal, or either is a
subdomain of the other. `filterCookiesForDomains` drops cookies without a
domain.

`signInConnector(deps, id, signal)` → `{signedIn: true} | {cancelled:
true}`: not found → `not_found`; `auth !== "cookies"` → `invalid_params
"Connector auth is <auth>, not cookies"`; target from
`connectorSignInTarget(connector)` (`how` must be an http(s) URL:
`invalid_params "Connector how is not a URL: <how>"` / `"Connector how must
be http(s) for cookie sign-in"`; returns `{url: url.toString(),
cookieDomains: [hostname]}`). Cancelled → nothing written. Otherwise save
`JSON.stringify(cookies)` to `<id>/cookies.json`, run `checkConnector` when
`deps.check` is set, return `{signedIn: true}`.

`signOutConnector(deps, id)` → `{status: "off"}`: not found → `not_found`;
`clearConnectorSecrets` (delete `<id>/cookies.json` and `<id>/token`);
status `off` with `checkedAt = now`; publish `connector/update
status_changed` (no detail); `onStatusChanged(... status "off")`.

## FCP bindings (`bind.ts`)

```ts
type ConnectorSignInBindingDeps = { secrets: SecretStore; chromeSignIn?; peer?: { request(method, params?) }; connection?: FcpConnection }
type CreateConnectorBindingsOptions = { check?: Omit<ConnectorCheckDeps, "service">; signIn?: ConnectorSignInBindingDeps }
createConnectorBindings(service, options?): ConnectorBindings
```

| Method                     | Behaviour                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connector/list`           | `service.list()` paged by `{cursor, limit}` (cursor = item id; unknown cursor → empty page; `next` = last id when more)                                                              |
| `connector/get`            | not found → `not_found`; `{connector, hash, status: live ?? "off", checkedAt?, detail?}`                                                                                             |
| `connector/save`           | `service.save(connector, baseHash)`; conflict → `conflict "Stale baseHash"` with `data {current: {connector, hash}}`; `{hash}`                                                       |
| `connector/remove`         | read record, `service.remove(id)`, clear secrets when `signIn.secrets` is configured, and if `check` is configured and the record existed call `onStatusChanged(status "off")`; `{}` |
| `connector/set_capability` | `service.setCapability(id, name, allowed, baseHash)`; conflict as save; `{hash}`                                                                                                     |
| `connector/check`          | requires `options.check` (`failed_precondition "Connector check is not configured"`); `checkConnector(..., ctx.signal)`                                                              |
| `connector/sign_in`        | requires `options.signIn` (`failed_precondition "Connector sign-in is not configured"`); `signInConnector` with `check: options.check`                                               |
| `connector/sign_out`       | requires both `signIn` and `check` (`failed_precondition "Connector sign-out is not configured"`); `signOutConnector`                                                                |

Param schemas (from contracts) reject secret-looking keys on save, and
reading a YAML containing a secret value fails on get (tests).
