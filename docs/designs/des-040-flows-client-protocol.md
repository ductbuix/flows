---
id: DES-040
title: Flows Client Protocol (FCP)
type: design
status: draft
summary: JSON-RPC 2.0 protocol between any UI and the engine, modelled on ACP; methods, updates, resync, errors, blobs, transports and versioning.
tags: [protocol, json-rpc, acp, api, electron, design]
related: [DES-039, DES-041, DES-042, DES-038]
updated: 2026-11-24
---

# Flows Client Protocol (FCP)

FCP is how a UI talks to the engine. It copies the shape of the Agent
Client Protocol (ACP) on purpose: JSON-RPC 2.0, an `initialize`
handshake with capabilities, `<namespace>/<verb>` methods, and one
`<namespace>/update` notification per stream with a discriminated
`kind`. The same peer library speaks ACP to agents (DES-041).

## Transports

A transport moves whole JSON-RPC messages; the peer above it is the same.

```ts
interface Transport {
  send(msg: JsonRpcMessage): void
  onMessage(fn: (msg: JsonRpcMessage) => void): () => void
  onClose(fn: (err?: Error) => void): () => void
  close(): void
}
```

| Transport     | Framing                                | Used by                            |
| ------------- | -------------------------------------- | ---------------------------------- |
| WebSocket     | one JSON text frame per message        | browser, desktop attach, CLI       |
| `MessagePort` | structured clone of the message object | Electron renderer to utility host  |
| stdio         | newline-delimited JSON (as ACP)        | `flows engine --stdio`, ACP agents |
| linked pair   | in memory, async microtask hop         | tests                              |

WebSocket auth: the daemon writes a per-launch token into
`engine.lock`; the browser gets it from the page the daemon serves (same
origin), a CLI reads the lock file. The socket checks `Origin` and the
token before `initialize`. `MessagePort` and stdio need no token (the
process boundary is the trust boundary).

## Lifecycle

1. Client sends `initialize`:
   `{ protocolVersion: 1, clientInfo: {name, version}, clientCapabilities }`.
2. Engine answers
   `{ protocolVersion, engineInfo, engineCapabilities, workspace: {home, id} }`.
   If versions differ the engine answers with the highest it supports; the
   client disconnects if it cannot speak it.
3. Client calls `subscribe` with topics and a cursor (below).
4. Normal calls and updates. Either side may close; the client
   reconnects with backoff and resubscribes with its last cursor.

### Capabilities

| Client capability    | Meaning                                                       |
| -------------------- | ------------------------------------------------------------- |
| `host.revealPath`    | client can show a path in Finder (desktop)                    |
| `host.browserSignIn` | client can open a sign-in window and return cookies (desktop) |
| `host.notifications` | client shows OS notifications for Inbox items                 |
| `updates.coalesced`  | client accepts merged chunk updates (all first-party clients) |

| Engine capability      | Meaning                                                |
| ---------------------- | ------------------------------------------------------ |
| `agents: AgentInfo[]`  | profiles found (`cursor`, versions, modes, models)     |
| `nodeKinds: string[]`  | node kinds this engine can run (registry, DES-035)     |
| `transports.connector` | connector transports available (`mcp`, `api`, `cli`)   |
| `blobs.http: url`      | base URL for blob GET/PUT, absent on MessagePort hosts |

Unknown capabilities are ignored. A UI hides a feature when the
capability is missing instead of checking versions.

## Methods

Method names are `<namespace>/<verb_snake>`, as in ACP (`session/new`).
Every method is declared once in `contracts` with zod `params` and
`result`; the engine binding and the sdk are generated from that table,
so a method cannot exist on one side only.

| Namespace   | Methods (requests)                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docket`    | `get_board`, `save_board`, `list_cards`, `get_card`, `create_card`, `update_card`, `move_card`, `delete_card`, `add_ref`, `add_asset`, `remove_asset`, `add_link` |
| `workflow`  | `list`, `get`, `create`, `save`, `rename`, `delete`, `save_layout`, `validate`                                                                                    |
| `run`       | `list`, `get`, `start`, `cancel`, `rerun`, `retry_step`, `delete`, `get_log`, `get_changes`                                                                       |
| `inbox`     | `list`, `answer`, `dismiss`                                                                                                                                       |
| `library`   | `list`, `get`, `add`, `pull`, `pin_version`, `set_tags`, `remove`, `list_providers`, `save_provider`                                                              |
| `connector` | `list`, `get`, `save`, `check`, `sign_in`, `sign_out`, `set_capability`, `remove`                                                                                 |
| `skill`     | `list`, `get`, `list_sources`, `install`, `uninstall`, `save`                                                                                                     |
| `file`      | `list`, `stat`, `read_text`, `write_text`, `reveal`                                                                                                               |
| `agent`     | `list`, `list_models`, `check`                                                                                                                                    |
| `settings`  | `get`, `set`                                                                                                                                                      |
| (root)      | `initialize`, `subscribe`, `unsubscribe`, `ping`                                                                                                                  |

Rules:

- **Commands vs queries.** `get_*`/`list*` never change state and are safe
  to retry. Commands carry an optional `requestKey` (client-made uuid);
  the engine stores it with the resulting event so a retried command after
  a dropped socket is applied once.
- **Optimistic concurrency.** Every document write takes `baseHash` and
  fails with `conflict` carrying the current document and hash (the 409
  rule today, DES-013/DES-038).
- **Lists page by cursor**: `{ cursor?, limit? }` to `{ items, next? }`.
  No offset paging.
- **Summaries in lists, bodies on get.** `list_cards` returns faces only
  (DES-038); `get_card` returns body, hash, backlinks, asset states.
- **Long work is a command plus updates.** `run/start` returns
  `{ runId }` at once; progress comes as `run/update`. `library/pull`
  returns `{ jobId }` the same way.
- **Cancellation.** A client cancels a pending request with the
  notification `$/cancel_request {id}`; the engine passes an
  `AbortSignal` into the service. This is separate from `run/cancel`,
  which stops a run.

## Updates (engine to client notifications)

One notification per namespace, payload discriminated by `kind`, the way
ACP uses `session/update` with `sessionUpdate`.

| Notification       | `kind` values                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docket/update`    | `card_changed` (face), `card_removed`, `board_changed`                                                                                                                      |
| `workflow/update`  | `workflow_changed`, `workflow_removed`, `layout_changed`                                                                                                                    |
| `run/update`       | `run_changed` (summary), `step_state`, `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `todos`, `usage`, `log_chunk`, `run_finished` |
| `inbox/update`     | `item_added`, `item_resolved`                                                                                                                                               |
| `library/update`   | `item_changed`, `job_progress`, `job_finished`                                                                                                                              |
| `connector/update` | `status_changed`                                                                                                                                                            |
| `skill/update`     | `skills_changed`                                                                                                                                                            |
| `file/update`      | `changed` (watched paths only)                                                                                                                                              |

Every update carries `seq` (engine-wide, monotonic, from the event log
or a projection counter) so the client can order and resume.

### Subscriptions and resync

```ts
subscribe({ topics: ["docket", "inbox", "run:r-104"], since?: seq })
  -> { seq, resync: Topic[] }
```

- Topics are a namespace (`docket`) or a namespace plus id (`run:r-104`)
  for heavy streams (agent chunks are only sent to `run:<id>`
  subscribers; `run` subscribers get `run_changed` and `step_state`).
- On reconnect the client sends its last `seq`. The engine replays
  buffered updates since then, or lists a topic in `resync` when the
  buffer no longer covers it; the client then refetches that topic with
  its `get`/`list` call. Clients never assume they saw every update.
- Chunk updates are coalesced per run per 50 ms (`updates.coalesced`);
  the full text is always in the step log, read by `run/get_log`.

## Engine to client requests (host capabilities)

The engine may ask the client to do what only a UI process can, and only
if the client declared the capability:

| Method                 | Params                                | Result                       |
| ---------------------- | ------------------------------------- | ---------------------------- |
| `host/browser_sign_in` | `{ connectorId, url, cookieDomains }` | `{ cookies }` or `cancelled` |
| `host/reveal_path`     | `{ path }`                            | `{}`                         |

Without the capability the engine uses its own adapter (today's
Chrome-based sign-in) or returns `unsupported`. Inbox questions are
**not** engine-to-client requests: they are Inbox items any client can
answer, because no single client owns them.

## Errors

JSON-RPC `error.code` plus a stable string `data.code`; UIs switch on
`data.code` only.

| `data.code`      | JSON-RPC code | When                                                      |
| ---------------- | ------------- | --------------------------------------------------------- |
| `invalid_params` | -32602        | zod rejected params; `data.issues` lists paths            |
| `not_found`      | -32004        | id does not exist                                         |
| `conflict`       | -32009        | stale `baseHash`; `data.current` holds disk copy and hash |
| `busy`           | -32010        | e.g. delete a workflow while a run is live                |
| `policy_denied`  | -32011        | a connector capability or trust rule forbids it           |
| `needs_trust`    | -32012        | agent CLI or folder not yet trusted (DES-019)             |
| `unsupported`    | -32013        | capability missing on this host or agent                  |
| `cancelled`      | -32800        | request cancelled by `$/cancel_request`                   |
| `internal`       | -32603        | bug; message is safe to show, details go to the log       |

## Blobs

Large or binary content (card assets, images, run outputs, log files)
never goes inline. Results carry `BlobRef = { id, name, size, mime }`.

| Host        | Read                                | Write                                                                   |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------- |
| daemon (ws) | `GET {blobs.http}/{id}` with token  | `PUT {blobs.http}` returns `BlobRef`, then pass `blobId` to the command |
| desktop     | custom protocol `flows-blob://{id}` | renderer passes a local path; main checks it                            |

Blob ids are opaque and scoped (card asset, run file, library file);
the engine resolves them, so the UI never builds a filesystem path.

## Versioning

- `protocolVersion` is an integer. Inside a version changes are additive
  only: new methods, new optional fields, new `kind` values.
- Readers are tolerant: unknown fields and unknown `kind`s are ignored
  (logged in development).
- Removing or changing a field means a new version; the engine serves the
  previous version for one release through an adapter in the binding.
- `contracts` exports `FCP_VERSION`; a contract test fails when the method
  table changes without a version note in this doc.
- v1 additive (2026-11-24): `workflow/list`, `workflow/get` (BL-123).
- v1 additive (2026-11-24): `file/list`, `file/stat`, `file/read_text`,
  `file/write_text`, `file/reveal` (BL-174).
- v1 additive (2026-11-24): `workflow/create`, `save`, `rename`, `delete`,
  `save_layout`, `validate` and `workflow/update` (BL-175).
- v1 additive (2026-11-24): `run/start`, `cancel`, `rerun`, `retry_step`,
  `delete`, `get_log`, `get_changes` and `run/update` `step_state` /
  `run_finished` (BL-176).
- v1 additive (2026-11-24): `docket/add_asset`, `docket/remove_asset`
  (BL-158).
- v1 additive (2026-11-24): `host/reveal_path` (BL-189).

## Example

```json
{"jsonrpc":"2.0","id":7,"method":"docket/move_card",
 "params":{"id":"fix-flaky-login","status":"review","beforeId":null,
           "baseHash":"9f2c","requestKey":"b1e0"}}
{"jsonrpc":"2.0","id":7,"result":{"hash":"a771","rank":"n"}}
{"jsonrpc":"2.0","method":"docket/update",
 "params":{"seq":5120,"kind":"card_changed",
           "card":{"id":"fix-flaky-login","status":"review","rank":"n"}}}
```
