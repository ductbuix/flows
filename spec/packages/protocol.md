# `@workspace/protocol` — JSON-RPC 2.0 peer and transports

Path: `packages/protocol`. Dependency-free (runtime). Used by `sdk`, `core`
(types only), `server`, `cli`, `desktop`, `agent-acp`, `mcp-gateway`.

## package.json

```json
{
  "name": "@workspace/protocol",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "exports": { ".": "./src/index.ts", "./node": "./src/node.ts" },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^26.6.6",
    "@types/ws": "^8.18.2",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0",
    "vitest": "^5.1.1",
    "ws": "^8.23.0"
  }
}
```

No build step: `exports` point at `.ts` sources; consumers compile them
(Vite / tsx / Electron bundler). All internal imports use explicit `.ts`
extensions.

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

## eslint.config.js

Standard package config (see [tooling.md](../tooling.md#eslint)) plus one
extra block: every `src/**/*.ts` except `src/node.ts`,
`src/ndjson-transport.ts` and tests forbids `node:*` imports with message
`default protocol entry must not import node:*; use @workspace/protocol/node`.
The `.` entry must stay browser-safe.

## Files

```
src/
  json-rpc.ts                 message types, error codes, type guards
  cancel.ts                   $/cancel_request helpers
  errors.ts                   JsonRpcResponseError, TransportClosedError, toJsonRpcError
  transport.ts                Transport interface
  rpc-peer-types.ts           RequestHandler, NotificationHandler
  rpc-inbound.ts              handleInboundMessage (responses, requests, notifications)
  rpc-peer.ts                 RpcPeer class
  linked.ts                   createLinkedTransports (in-memory pair)
  ws-transport.ts             wsTransport(WsLike)
  message-port-transport.ts   messagePortTransport(MessagePortLike)
  ndjson-transport.ts         ndjsonTransport(Readable, Writable)  [node only]
  index.ts                    browser-safe entry
  node.ts                     node entry: export { ndjsonTransport, type NdjsonTransport }
  *.test.ts                   rpc-peer, ws, message-port, ndjson tests
```

## json-rpc.ts

```ts
export const JSONRPC_VERSION = "2.0" as const
export type JsonRpcId = string | number
export type JsonRpcErrorObject = {
  code: number
  message: string
  data?: unknown
}
export type JsonRpcRequest = {
  jsonrpc: "2.0"
  method: string
  params?: unknown
  id: JsonRpcId
}
export type JsonRpcNotification = {
  jsonrpc: "2.0"
  method: string
  params?: unknown
}
export type JsonRpcSuccess = {
  jsonrpc: "2.0"
  result: unknown
  id: JsonRpcId | null
}
export type JsonRpcFailure = {
  jsonrpc: "2.0"
  error: JsonRpcErrorObject
  id: JsonRpcId | null
}
export type JsonRpcMessage =
  JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcFailure

export const JSONRPC_PARSE_ERROR = -32700
export const JSONRPC_INVALID_REQUEST = -32600
export const JSONRPC_METHOD_NOT_FOUND = -32601
export const JSONRPC_INVALID_PARAMS = -32602
export const JSONRPC_INTERNAL_ERROR = -32603
export const JSONRPC_REQUEST_CANCELLED = -32800 // DES-040
```

Guards:

- `isJsonRpcRequest(m)`: `jsonrpc==="2.0"`, has `method`, has `id`, id not
  `undefined`/`null`.
- `isJsonRpcNotification(m)`: `jsonrpc==="2.0"`, has `method`, no `id` key.
- `isJsonRpcResponse(m)`: `jsonrpc==="2.0"`, has `result` or `error`, has `id`.

## cancel.ts

- `CANCEL_REQUEST_METHOD = "$/cancel_request"`; params `{ id }`.
- `RequestContext = { readonly signal: AbortSignal }` (passed to handlers).
- `RequestOptions = { readonly signal?: AbortSignal }` (passed to `request`).
- `cancelledErrorObject(message = "Request cancelled")` →
  `{ code: -32800, message, data: { code: "cancelled" } }`.
- `cancelRequestId(params)` → `params.id` when string or number, else `undefined`.

## errors.ts

- `class JsonRpcResponseError extends Error` — `name="JsonRpcResponseError"`,
  readonly `code`, `data?`; constructed from a `JsonRpcErrorObject`.
- `class TransportClosedError extends Error` — message `cause?.message ?? "transport closed"`.
- `toJsonRpcError(thrown)`: `JsonRpcResponseError` → its code/message/data
  (data only if defined); other `Error` → `-32603` + message; anything else
  → `-32603` + `String(thrown)`.

## transport.ts

```ts
export type Transport = {
  send(msg: JsonRpcMessage): void
  onMessage(fn: (msg: JsonRpcMessage) => void): () => void // returns unsubscribe
  onClose(fn: (err?: Error) => void): () => void
  close(): void
}
```

## RpcPeer (rpc-peer.ts + rpc-inbound.ts)

State: `nextId` (starts 1, integer ids), `pending` map id→{resolve,reject},
`inflight` map id→`{controller: AbortController, done: boolean}`,
`cancelledIds` set, `requestHandlers`, `notificationHandlers`, `closed`.

Constructor subscribes to `transport.onMessage` (→ `handleInboundMessage`,
fire-and-forget) and `transport.onClose` (rejects all pending with
`TransportClosedError(err)`, sets closed).

Public API:

| Method                                | Behavior                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request(method, params?, {signal}?)` | Rejects immediately with `TransportClosedError` if closed. Sends `{jsonrpc, method, params?, id}` (omit `params` key if undefined). On abort: notify `$/cancel_request {id}`, drop pending, reject with `JsonRpcResponseError(cancelledErrorObject())`. If signal already aborted: send the request, then run abort. |
| `notify(method, params?)`             | No-op when closed.                                                                                                                                                                                                                                                                                                   |
| `onRequest(method, handler)`          | Registers one handler per method (Map.set, last wins); returns unregister.                                                                                                                                                                                                                                           |
| `onNotification(method, handler)`     | Same for notifications.                                                                                                                                                                                                                                                                                              |
| `close()`                             | `transport.close()` if not closed.                                                                                                                                                                                                                                                                                   |
| `dispose()`                           | Unsubscribe transport listeners, clear handlers, abort every inflight controller, clear cancelled ids, reject pending with `TransportClosedError`.                                                                                                                                                                   |

Inbound handling:

1. **Response**: look up pending by id; `error` → reject
   `JsonRpcResponseError`; `result` → resolve. Unknown ids ignored.
2. **Request**:
   - if id in `cancelledIds` (cancel arrived first): delete it, reply cancelled error;
   - no handler → `-32601 "Method not found: <method>"`;
   - otherwise create inflight entry, `await handler(params, {signal})`,
     reply `result ?? null`. On throw: if signal aborted reply cancelled,
     else `toJsonRpcError(thrown)`. A `respond` guard sends at most once.
3. **Notification**: `$/cancel_request` → `honourCancel`: unknown id →
   add to `cancelledIds`; known and not done → abort controller, mark done,
   delete, send cancelled error immediately. Other notifications: call
   handler, swallow errors; unknown methods ignored.

## createLinkedTransports() (linked.ts)

Returns `[a, b]`. `send` delivers to the other half's listeners in a
microtask (`Promise.resolve().then`), skipping if either side is closed.
`close()` on either half closes both and fires close listeners on both.
Used for in-process hosting (cli `--linked`, tests).

## wsTransport(socket: WsLike)

`WsLike = { send(data: string); close(); addEventListener; removeEventListener }`
(browser WebSocket and `ws` both satisfy it).

- One JSON **text** frame per message; binary frames are logged
  (`console.error("wsTransport: binary frame rejected")`) and dropped;
  parse failures logged (`"wsTransport: text frame parse failed"`).
- `error` event stores an `Error` (from event itself, `event.error`, a
  non-empty `event.message`, else `"WebSocket error"`); the next `close`
  event fires close listeners with it.
- `close()` calls `socket.close()`; listeners fire on the socket's `close` event.

## messagePortTransport(port: MessagePortLike)

Works with DOM `MessagePort`, Electron `MessagePortMain`, worker_threads
`MessagePort`. Listens via `addEventListener` if present, else `on`/`off`,
else throws `"messagePortTransport: port cannot listen for events"`.
Payload = `event.data` when event is an object with `data`, else the event.
Structured clone (no JSON stringify). Calls `port.start?.()`. `close()`
calls `port.close()` and fires close listeners immediately (some platforms
do not emit `close` for local closes).

## ndjsonTransport(readable, writable) — `@workspace/protocol/node`

`NdjsonTransport = Transport & { onError(fn): () => void }`.
One JSON per line, `\n` delimited; trailing `\r` stripped; empty lines
skipped; malformed line → error listeners get
`Error("ndjsonTransport: malformed line: <msg>", {cause})` (transport
stays open). On `end`: flush remaining buffer as a line, then close.
Readable/writable `error` → close with that error. `send` writes
`JSON.stringify(msg) + "\n"`. `close()` closes, destroys readable, ends
writable if not ended.

## Tests (vitest)

- `rpc-peer.test.ts`: request/response, method-not-found, error mapping,
  cancel before/after dispatch, abort signal, close rejects pending.
- `ws-transport.test.ts`: real `ws` server on 127.0.0.1 port 0.
- `message-port-transport.test.ts`: `node:worker_threads` `MessageChannel`.
- `ndjson-transport.test.ts`: `PassThrough` streams, CRLF, malformed line.
