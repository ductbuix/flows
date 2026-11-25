# core: FCP binding (rpc), UpdateBus (updates), method index

Part of the [`@workspace/core` spec](core.md). Covers `src/rpc/`,
`src/updates/`, and indexes every FCP method that core binds.

FCP (Flows Client Protocol) is JSON-RPC 2.0 over `@workspace/protocol`'s
`RpcPeer` (see [protocol.md](protocol.md)). Method definitions (name,
zod `params`/`result`, kind) live in `@workspace/contracts` (`fcp/*.ts`,
`defineMethod`, `FcpMethodDef`, `FcpMethodParams<M>`, `FcpMethodResult<M>`).
Core turns services into `MethodBindings` and attaches them to a peer.

## Files

| File                        | Purpose                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `rpc/context.ts`            | `ClientInfo`, `ClientContext`                                                                                                                |
| `rpc/bind.ts`               | `MethodHandler`, `MethodBinding`, `MethodBindings`, `defineBinding`, `bindEngine`, `BindEngineOptions`                                       |
| `rpc/initialize.ts`         | `FcpConnection`, `createFcpConnection`, `bindInitialize`, `invalidRequestError`                                                              |
| `rpc/map-error.ts`          | `isEngineError`, `invalidParamsError`, `engineErrorToJsonRpc`, `internalError`                                                               |
| `rpc/index.ts`              | barrel (everything above except map-error helpers)                                                                                           |
| `updates/types.ts`          | `BufferedUpdate`, `UpdateNotifyPeer`                                                                                                         |
| `updates/topics.ts`         | `parseTopic`, `notificationNamespace`, `updateMatchesTopic`                                                                                  |
| `updates/update-bus.ts`     | `UpdateBus`, `UpdateBusOptions`                                                                                                              |
| `updates/bind-subscribe.ts` | `createSubscribeBindings` (`subscribe`, `unsubscribe`)                                                                                       |
| `updates/index.ts`          | barrel: `createSubscribeBindings`, `parseTopic`, `updateMatchesTopic`, `BufferedUpdate`, `UpdateNotifyPeer`, `UpdateBus`, `UpdateBusOptions` |

The package root exports `createSubscribeBindings`, `UpdateBus`,
`updateMatchesTopic`, `BufferedUpdate`, `UpdateBusOptions`,
`UpdateNotifyPeer` (not `parseTopic`), and from rpc: `bindEngine`,
`bindInitialize`, `createFcpConnection`, `defineBinding`,
`invalidRequestError`, `BindEngineOptions`, `BindInitializeOptions`,
`ClientContext`, `ClientInfo`, `FcpConnection`, `MethodBinding`,
`MethodBindings`, `MethodHandler`.

## rpc/

```ts
type ClientInfo = { readonly name: string; readonly version: string }
type ClientContext = { readonly signal: AbortSignal; readonly clientInfo?: ClientInfo }
type MethodHandler<M extends FcpMethodDef> = (params: FcpMethodParams<M>, ctx: ClientContext) => FcpMethodResult<M> | Promise<...>
type MethodBinding<M = FcpMethodDef> = { readonly method: M; readonly handler: MethodHandler<M> }
type MethodBindings = Record<string, MethodBinding>
defineBinding(method, handler): MethodBinding    // returns { method, handler }
type BindEngineOptions = { readonly logger?: Logger; readonly validateResults?: boolean; readonly connection?: FcpConnection }
bindEngine(peer: RpcPeer, bindings: MethodBindings, ctx: ClientContext, options?): Disposable
```

`bindEngine` registers `peer.onRequest(name, ...)` for every entry (the
record key is the method name). Per request:

1. If `options.connection` is set and not `initialized` → throw
   `invalidRequestError("Initialize required")`.
2. `method.params.safeParse(raw ?? {})`; failure → `invalidParamsError`.
3. `await handler(parsed, ctx)` (the same `ctx` for the whole connection).
4. If result validation is on (`validateResults` option, default: on unless
   `globalThis.process.env.NODE_ENV === "production"`): `method.result.
safeParse(result)`; failure → log `error("fcp handler returned invalid
result", {method})` and throw `internalError("Invalid result")`; else use
   the parsed data (zod strips/defaults).
5. Errors: `JsonRpcResponseError` rethrown as is; `EngineError`-shaped
   objects (`isEngineError`: object with string `code` and string
   `message`) → `engineErrorToJsonRpc`; anything else → log `error("fcp
handler failed", {method, err: message})` and throw
   `internalError(err.message ?? "Internal error")`.

`dispose()` unregisters all handlers.

### Initialize

```ts
type FcpConnection = { initialized: boolean; clientInfo?: ClientInfo; clientCapabilities?: Record<string, unknown>; protocolVersion?: number }
createFcpConnection(): FcpConnection     // { initialized: false }
type BindInitializeOptions = {
  readonly engineInfo: ClientInfo
  readonly workspace: { readonly home: string; readonly id: string }
  readonly engineCapabilities?: { readonly blobs?: { readonly http: string } }
}
bindInitialize(peer, connection, options): Disposable
invalidRequestError(message) → JsonRpcResponseError { code: -32600, message, data: { code: "invalid_request" } }
```

`initialize` handler: parse params with contracts
`initializeMethod.params` (`{clientInfo, clientCapabilities}`; failure →
`invalidParamsError`); set `connection.initialized = true`, `clientInfo`,
`clientCapabilities`, `protocolVersion = FCP_VERSION` (1). Result
`{protocolVersion: FCP_VERSION, engineInfo, engineCapabilities: {agents: [],
nodeKinds: [], blobs?}, workspace}` validated by the method's result schema
(failure → JSON-RPC `-32603 "Invalid initialize result"` with `data {code:
"internal"}`). The engine always answers with its own protocol version,
even when the client sent an older one. Re-initialize is allowed. Methods
bound with `connection` reject with `invalid_request` until then.

Client capabilities read elsewhere in core: `host.browserSignIn` (connector
sign-in through `host/browser_sign_in`) and `host.revealPath`
(`host/reveal_path`).

### Error mapping (`map-error.ts`)

FCP codes (contracts `ErrorCode`): `invalid_params -32602`, `not_found
-32004`, `conflict -32009`, `busy -32010`, `policy_denied -32011`,
`needs_trust -32012`, `unsupported -32013`, `cancelled -32800`, `internal
-32603`.

- `engineErrorToJsonRpc(e)`: known code → its number and `data.code = code`;
  unknown codes (e.g. `failed_precondition`) → `-32603` with `data.code =
"internal"`. `message` kept. `data` merge: `e.data` undefined → `{code}`;
  plain object → `{code, ...data}`; other values → `{code, detail: data}`.
- `invalidParamsError(zodError)` → `-32602 "Invalid params"`, `data {code:
"invalid_params", issues: [{path}]}` (paths only, no messages).
- `internalError(message)` → `-32603`, `data {code: "internal"}`.

## updates/ (UpdateBus)

```ts
type BufferedUpdate = { readonly seq: number; readonly notification: string; readonly params: Record<string, unknown> & { kind: string } }
type UpdateNotifyPeer = { notify(method: string, params: unknown): void }
type UpdateBusOptions = { readonly replayBufferSize?: number }    // default 500, min 1
class UpdateBus {
  currentSeq(): number
  publish(notification: string, params: { kind: string; ... }): BufferedUpdate
  subscribe(peerId, peer, params: { topics: string[]; since?: number }): { seq: number; resync: string[] }
  unsubscribe(peerId, params: { topics: string[] }): {}
  detachPeer(peerId): void
}
```

- One global monotonic `seq` from 1. `publish` stamps `params.seq`, appends
  to a ring buffer (drop oldest beyond the size), and synchronously notifies
  every subscribed peer whose topics match (`peer.notify(notification,
stampedParams)`).
- `subscribe`: create or extend the peer's topic set. If `since` is given:
  for each requested topic, when `since + 1 < bufferMinSeq` (the oldest
  buffered seq, or `seq + 1` when the buffer is empty) the topic goes into
  `resync` (the client must refetch); then replay every buffered update with
  `seq > since` that matches any of the peer's topics, in order. Returns
  `{seq: current, resync}`.
- `unsubscribe`: remove topics; the peer entry is dropped when no topics
  remain. Unknown peer → `{}`.
- `detachPeer`: drop the peer (transport closed).

Topics (`topics.ts`): `parseTopic("ns")` → namespace topic;
`parseTopic("ns:id")` → scoped (an empty side falls back to namespace with
the whole string). `notificationNamespace("ns/update")` = text before the
first `/`. `updateMatchesTopic(topic, notification, params)`:

1. Namespace must equal the notification's namespace.
2. Non-`run` namespaces: always match (scoped ids are not filtered).
3. `run:<id>`: match only when `params.runId === id`.
4. Plain `run`: only "light" kinds `run_changed` and `step_state`
   (contracts `RUN_LIGHT_KINDS`); heavy kinds (agent chunks, tool calls,
   plans, usage...) need `run:<id>`.

`createSubscribeBindings(bus, peer, peerId)` → `{bindings: {subscribe,
unsubscribe}, dispose}`; `subscribe` → `bus.subscribe(peerId, peer,
params)`, `unsubscribe` → `bus.unsubscribe(peerId, params)`; `dispose()` →
`bus.detachPeer(peerId)`.

Notifications published by core:

| Notification       | Kinds                                                                     | Publisher                            |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------ |
| `inbox/update`     | `item_added`, `item_resolved`                                             | `InboxService`                       |
| `connector/update` | `status_changed`                                                          | `checkConnector`, `signOutConnector` |
| `docket/update`    | `card_changed`, `card_removed`, `board_changed`                           | docket bindings, run refs            |
| `library/update`   | `item_changed`, `item_removed`, `job_progress`, `job_finished`            | `LibraryService`, jobs               |
| `skill/update`     | `skills_changed`                                                          | catalog watcher, install, sources    |
| `run/update`       | payloads from `mapAgentEventToRunUpdate` (via the host and the coalescer) | host (`apps/server`)                 |

## FCP methods bound by core

| Namespace | Methods                                                                                                    | Factory                                                     | Spec                                     |
| --------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| lifecycle | `initialize`                                                                                               | `bindInitialize`                                            | above                                    |
| updates   | `subscribe`, `unsubscribe`                                                                                 | `createSubscribeBindings`                                   | above                                    |
| inbox     | `inbox/list`, `inbox/answer`, `inbox/dismiss`                                                              | `createInboxBindings`                                       | [core-inbox.md](core-inbox.md)           |
| connector | `connector/list`, `get`, `save`, `remove`, `set_capability`, `check`, `sign_in`, `sign_out`                | `createConnectorBindings`                                   | [core-connectors.md](core-connectors.md) |
| docket    | `docket/get_board`, `list_cards`, `get_card`                                                               | `createDocketReadBindings`                                  | [core-docket.md](core-docket.md)         |
| docket    | `docket/create_card`, `update_card`, `move_card`, `delete_card`, `add_asset`, `remove_asset`, `save_board` | `createDocketWriteBindings`                                 | [core-docket.md](core-docket.md)         |
| library   | `library/list_providers`, `save_provider`                                                                  | `createLibraryProviderBindings`                             | [core-library.md](core-library.md)       |
| library   | `library/list`, `get`, `pull`, `push`, `add`, `unlink`, `pin_version`, `set_tags`, `remove`                | `createLibraryItemBindings` (both: `createLibraryBindings`) | [core-library.md](core-library.md)       |
| skill     | `skill/list`, `skill/get`                                                                                  | `createSkillReadBindings`                                   | [core-workspace.md](core-workspace.md)   |
| skill     | `skill/install`, `skill/uninstall`                                                                         | `createSkillInstallBindings`                                | [core-workspace.md](core-workspace.md)   |
| skill     | `skill/list_sources`, `skill/save`                                                                         | `createSkillSourcesBindings`                                | [core-workspace.md](core-workspace.md)   |
| file      | `file/list`, `stat`, `read_text`, `write_text`, `reveal`                                                   | `createFileBindings`                                        | [core-workspace.md](core-workspace.md)   |
| settings  | `settings/cli_status`, `get_trust`, `set_trust`, `list_mcp_trust`, `set_mcp_trust`                         | `createSettingsBindings`                                    | [core-workspace.md](core-workspace.md)   |

Server→client requests issued by core: `host/browser_sign_in`,
`host/reveal_path`.

Not bound in core (the host in `apps/server` / `server/fcp-host` binds them
using core's runs, nodes and inbox pieces): `ping`, `run/*` (`start`,
`cancel`, `delete`, `get`, `get_changes`, `get_log`, `list`, `rerun`,
`retry_step`), `workflow/*`, `agent/list`, and the `run/update` /
`notice/update` notifications.

## Typical host wiring (informative)

```ts
const conn = createFcpConnection()
bindInitialize(peer, conn, { engineInfo, workspace })
const { bindings: sub, dispose } = createSubscribeBindings(bus, peer, peerId)
bindEngine(
  peer,
  {
    ...sub,
    ...createInboxBindings(inbox),
    ...createConnectorBindings(connectors, opts),
    ...createDocketReadBindings(r),
    ...createDocketWriteBindings(w),
    ...createLibraryBindings(p, l),
    ...createSkillReadBindings(s),
    ...createFileBindings(f),
    ...createSettingsBindings(ports),
    ...hostBindings,
  },
  { signal },
  { connection: conn, logger }
)
```
