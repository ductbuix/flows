# `@workspace/sdk` — FCP client (`createClient`)

Path: `packages/sdk`. Browser- and Node-safe client for the Flows Client
Protocol (DES-040). Wraps a `RpcPeer` from `@workspace/protocol`, performs
the `initialize` handshake, validates every call with the zod method table
from `@workspace/contracts`, queues calls until ready, reconnects with
exponential backoff, and resubscribes with the last seen `seq`.

Used by: `apps/web` (WebSocket or MessagePort), `apps/cli` (WebSocket or
linked), `packages/sdk-react`, tests.

## package.json

```json
{
  "name": "@workspace/sdk",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@workspace/contracts": "workspace:*",
    "@workspace/protocol": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1"
  }
}
```

No build step; `exports` point at `.ts`. Internal imports use `.ts`.

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

## eslint.config.js

Identical to the server config ([server.md](../apps/server.md#eslintconfigjs)):
`globalIgnores(["dist"])`, `noCycleBlock`, recommended JS + TS on `**/*.ts`
with `globals.node`, `max-lines` warn 200 (tests/specs 300). No vitest
config file (defaults).

## Files

```
src/
  index.ts          public exports
  client.ts         createClient(): state machine, reconnect loop, public API
  calls.ts          createClientCalls(): dispatch, queue, resubscribe
  connect.ts        resolveConnect(): url | transport | factory -> () => Promise<Transport>
  session.ts        openSession(): peer + handlers + initialize; deliverNotification
  subscriptions.ts  createSubscriptionTracker(): topics + lastSeq + resync events
  initialize.ts     buildInitializeParams, isSupportedProtocolVersion, types
  backoff.ts        createBackoff, sleep
  errors.ts         RetryableConnectionError, ProtocolVersionError, asRetryable
  types.ts          FlowsClient, CreateClientOptions, method/notification name types
  client.test.ts    integration tests over linked transports
```

## Public exports (`index.ts`)

- Values: `createClient`, `ProtocolVersionError`, `RetryableConnectionError`.
- Types: `ClientEventMap`, `CreateClientOptions`, `FlowsClient`,
  `FcpCallParams`, `FcpCallResult`, `FcpHostMethodName`, `FcpHostParams`,
  `FcpHostResult`, `FcpMethodName`, `FcpNotificationName`,
  `BackoffOptions`, `ClientCapabilities`, `ClientInfo`, `InitializeParams`,
  `InitializeResult`.

## Types (`types.ts`, `initialize.ts`)

```ts
type FcpMethodName       = keyof typeof fcpMethodTable        // contracts
type FcpNotificationName = keyof typeof fcpNotificationTable
type FcpHostMethodName   = keyof typeof fcpHostMethodTable    // engine -> client
type FcpCallParams<M>  = FcpMethodParams<(typeof fcpMethodTable)[M]>
type FcpCallResult<M>  = FcpMethodResult<(typeof fcpMethodTable)[M]>
type FcpHostParams<M>  / FcpHostResult<M>  // same over fcpHostMethodTable

type CreateClientOptions = {
  transport?: Transport | (() => Transport | Promise<Transport>)
  url?: string
  token?: string
  capabilities?: ClientCapabilities     // default {}
  clientInfo?: ClientInfo               // default { name: "@workspace/sdk", version: "0.0.0" }
  backoff?: BackoffOptions
}
type ClientEventMap = { resync: (topic: string) => void }

type FlowsClient = {
  readonly ready: Promise<InitializeResult>
  call<M>(method: M, params: FcpCallParams<M>): Promise<FcpCallResult<M>>
  onNotification<M>(method: M, handler: (params) => void): () => void
  onRequest<M extends FcpHostMethodName>(method: M, handler: (params) => Result | Promise<Result>): () => void
  on<E extends keyof ClientEventMap>(event: E, handler): () => void
  close(): void
}

InitializeParams  = params of contracts initializeMethod
InitializeResult  = result of initializeMethod
ClientInfo        = InitializeParams["clientInfo"]          // {name, version}
ClientCapabilities = InitializeParams["clientCapabilities"]
```

`buildInitializeParams(clientInfo, caps)` → `{ protocolVersion:
FCP_VERSION, clientInfo, clientCapabilities: caps }`.
`isSupportedProtocolVersion(v)` → `v === FCP_VERSION` (contracts; `1`).

## Errors (`errors.ts`)

- `RetryableConnectionError extends Error`: `name =
"RetryableConnectionError"`, `retryable = true`, default message
  `"connection dropped"`, optional `cause`.
- `ProtocolVersionError extends Error`: `name = "ProtocolVersionError"`,
  message `unsupported protocolVersion: <v>`.
- `asRetryable(err)`: pass-through if already retryable; else new
  `RetryableConnectionError(err.message or "connection dropped", err)`.

## Backoff (`backoff.ts`)

`createBackoff({ initialMs = 250, maxMs = 30_000 })` →
`nextDelayMs()` returns `min(initialMs * 2^attempt, maxMs)` then
`attempt++`; `reset()` sets `attempt = 0`. Sequence with defaults: 250,
500, 1000, 2000, 4000, 8000, 16000, 30000, 30000, … No jitter.

`sleep(ms, signal?)`: rejects immediately with `signal.reason ?? Error(
"aborted")` if already aborted; else `setTimeout`, and abort clears the
timer and rejects the same way.

## Connect (`connect.ts`)

`resolveConnect({ transport, url, token }) → () => Promise<Transport>`:

| Input                      | Behavior                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| both `transport` and `url` | throw `createClient: pass transport or url, not both` (synchronously from `createClient`)                                                                                    |
| neither                    | throw `createClient: transport or url is required`                                                                                                                           |
| `url`                      | each call opens a new WebSocket (below)                                                                                                                                      |
| `transport` is a function  | each call invokes the factory (sync or async)                                                                                                                                |
| static `transport`         | first call returns it; later calls reject `createClient: static transport already closed; pass a factory or url to reconnect` (so reconnect loops keep failing with backoff) |

WebSocket open: uses `globalThis.WebSocket` (browser, or Node ≥ 22 global);
missing → reject `WebSocket is not available in this runtime`. URL gets
`token` set as the `token` search param (`URL.searchParams.set`, replacing
any existing) when `token` is truthy. Resolves `wsTransport(socket)` on
`open`; rejects `WebSocket failed to open` on `error`; both listeners are
removed after either fires. No connect timeout.

## Session (`session.ts`)

`openSession(connect, clientInfo, caps, hooks, closed) →
{peer, transport, initialize}`:

1. `transport = await connect()`; `peer = new RpcPeer(transport)`.
2. For every method already in `hooks.notificationHandlers`, register
   `peer.onNotification(method, p => deliverNotification(hooks, method, p))`.
3. Bind every host handler from `hooks.hostHandlers`: on request, parse
   params with `fcpHostMethodTable[method].params` (`raw ?? {}`), await
   handler, parse result with `.result` (`result ?? {}`); unknown method
   in the table → raw pass-through.
4. `transport.onClose(err => { if (!closed()) hooks.onDrop(err) })`.
5. `raw = await peer.request("initialize", buildInitializeParams(...))`;
   `initialize = initializeMethod.result.parse(raw)`.
6. Unsupported `protocolVersion` → `peer.dispose()`, `transport.close()`,
   throw `ProtocolVersionError`.

`deliverNotification(hooks, method, params)`: `hooks.onNotify?.(method,
params)` first (seq tracking), then each handler in the set, in
insertion order.

## Subscription tracker (`subscriptions.ts`)

State: `topics: Set<string>`, `lastSeq: number | undefined`.

| Method                        | Behavior                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `noteParamsSeq(params)`       | If params is an object with finite numeric `seq >= 0`: `lastSeq = max(lastSeq, seq)`. Applied to **every** notification. |
| `onSubscribe(params, result)` | Add each `params.topics`; note `result.seq`; call `emitResync(topic)` for each `result.resync` entry.                    |
| `onUnsubscribe(params)`       | Remove each topic.                                                                                                       |
| `resubscribeParams()`         | `undefined` if no topics; else `{ topics: [...topics], since?: lastSeq }` (`since` only when known).                     |

`lastSeq` is never reset (survives reconnects; engine `seq` is global).

## Calls (`calls.ts`)

`createClientCalls(gate: {getPeer, isReady}, tracker)`; internal FIFO
`queue` of `{method, params, resolve, reject}`.

`dispatch(method, params)`:

1. If no peer or not ready → push onto the queue and return its promise
   (no validation yet).
2. `def = fcpMethodTable[method]`; `def.params.safeParse(params ?? {})`;
   failure → throw the `ZodError` (promise rejects).
3. `result = def.result.parse(await peer.request(method, parsed.data))`
   (result validation failure rejects with ZodError).
4. Track: `subscribe` → `tracker.onSubscribe(parsedParams, result)`;
   `unsubscribe` → `tracker.onUnsubscribe(parsedParams)`.
5. `TransportClosedError` from the peer → rethrow as
   `RetryableConnectionError` (in-flight calls are **not** retried or
   re-queued). Other errors (e.g. `JsonRpcResponseError`) pass through.

`flushQueue()`: take all queued items (FIFO) and `dispatch` each again,
settling the original promise (if the link dropped meanwhile they re-queue).
`resubscribe()`: no peer or no tracked topics → no-op; else validate
`tracker.resubscribeParams()` with `subscribeMethod.params`, request
`subscribe` directly on the peer (bypassing the queue), parse result, then
`tracker.onSubscribe` (fires resync events). `rejectQueue(err)`: reject and
clear all queued.

## createClient (`client.ts`) — algorithm

State: `peer`, `transport`, `sessionReady`, `closedByUser`, `settledReady`,
`reconnecting`, `notificationHandlers: Map<method, Set<fn>>`,
`hostHandlers: Map<method, fn>`, `resyncHandlers: Set<fn>`,
`abortReconnect: AbortController`, tracker (emits resync to
`resyncHandlers`), calls (`gate = {peer, sessionReady}`), backoff.

`sessionHooks.onDrop()`: clear peer/transport, `sessionReady = false`,
`ensureReconnect()`.

`startSession()`:

1. `openSession(...)` (above).
2. Set `peer`, `transport`, `sessionReady = true`, `backoff.reset()`.
3. `await calls.resubscribe()` (only on reconnect in practice; the first
   session has no topics).
4. `calls.flushQueue()`.
5. Return the initialize result.

Initial connect (synchronous in `createClient`): `startSession().then(
settleReady)`; on error: ignore if closed; `ProtocolVersionError` →
`failReady(err)` (no retry); anything else → `ensureReconnect()`.

`ensureReconnect()`: return if closed or already reconnecting; loop while
not closed: `await sleep(backoff.nextDelayMs(), abortReconnect.signal)`;
`settleReady(await startSession())` and return on success; on error:
return if closed; `ProtocolVersionError` → `failReady` and stop; otherwise
continue looping (next, longer delay). Note the first reconnect attempt
waits 250 ms (backoff is not consulted for the very first connect).

`ready`: resolves with the first successful `InitializeResult` (later
reconnects do not change it); rejects only on `ProtocolVersionError` or
`close()` before ready (`RetryableConnectionError("client closed")`).
Connection failures before the first success do **not** reject `ready`;
it stays pending while retrying.

Public API:

| Member                            | Behavior                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `call(method, params)`            | `calls.dispatch`. Before ready / during reconnect: queued and sent after the next successful initialize + resubscribe.                                                                                                                                                                                              |
| `onNotification(method, handler)` | First handler for a method also registers on the current peer (if any); future sessions register all known methods in `openSession`. Returns unsubscribe (removes from set; peer registration stays).                                                                                                               |
| `onRequest(method, handler)`      | Stores handler (last wins) and, if a peer exists, registers it now with params/result parsing via `fcpHostMethodTable`. Unsubscribe removes the stored handler only if it is still the same (peer registration for the current session remains).                                                                    |
| `on("resync", handler)`           | Adds to resync handlers; returns remover. Any other event name throws `unknown client event: <name>`.                                                                                                                                                                                                               |
| `close()`                         | `closedByUser = true`; abort reconnect sleep; `sessionReady = false`; reject queued calls and (if pending) `ready` with `RetryableConnectionError("client closed")`; `peer.dispose()` (rejects in-flight with `TransportClosedError`, surfaced as retryable); `transport.close()`. Idempotent enough to call twice. |

Ordering guarantees: queued calls go out FIFO after `resubscribe`;
notifications are delivered synchronously in arrival order; `seq` is
noted before handlers run.

## Tests (`client.test.ts`, linked transports + fake engine peer)

- initialize, calls queued before ready resolve with typed results;
- engine notifications reach `onNotification` handlers;
- on drop, in-flight calls reject with `RetryableConnectionError`
  (`retryable: true`) and the client reconnects (factory transport);
- after reconnect it resubscribes with `{topics, since: lastSeq}` and
  replayed updates are delivered;
- `host/reveal_path` and `host/browser_sign_in` engine requests reach
  `onRequest` handlers and results are returned;
- `subscribe` returning `resync: [topic]` fires `on("resync")`.
