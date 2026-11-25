# `@workspace/agent-acp` — ACP agent runtime, profiles, fake agent

Path: `packages/agent-acp`. Implements the core `AgentRuntime` port
(`@workspace/core` `ports/agent-runtime.ts`) over the Agent Client Protocol
(ACP, JSON-RPC 2.0 ndjson over the agent CLI's stdio). Default profile is
Cursor (`agent acp`); a generic spec-only profile exists. Also ships an
in-process scripted fake agent for tests (`./testing`). Design: DES-041
(agent runtime), DES-042 (ACP log / fake agent), BL-137..BL-150, BL-167,
BL-170, BL-192.

## package.json

```json
{
  "name": "@workspace/agent-acp",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "exports": { ".": "./src/index.ts", "./testing": "./src/testing/index.ts" },
  "dependencies": {
    "@workspace/contracts": "workspace:*",
    "@workspace/core": "workspace:*",
    "@workspace/protocol": "workspace:*",
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

No build; exports point at `.ts`. Internal imports use explicit `.ts`.
`@workspace/contracts` is used only by test helpers (types).

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

## eslint.config.js

Flat config: `globalIgnores(["dist"])`; `**/*.ts` extends
`js.configs.recommended` + `tseslint.configs.recommended` with
`globals.node`; `noCycleBlock` from `../../eslint-dependency-guards.mjs`
(`import/no-cycle` error, `maxDepth: Infinity`, via `eslint-plugin-import-x`
registered as `import`); `max-lines` warn 200 (`skipBlankLines`,
`skipComments`) for `**/*.{ts,tsx}`, 300 for `**/*.test.*` / `**/*.spec.*`.
No restricted-imports block (the root guard
`adaptersRestrictedImports` forbids _adapters-node_ from importing this
package, not the reverse).

## Files

```
src/
  index.ts                     public exports (also re-exports ./testing)
  acp-log.ts                   ACP ndjson log sink, secret redaction, logging transport
  ask-question.ts              CURSOR_ASK_QUESTION_METHOD
  authenticate.ts              authenticateIfRequired (needs_trust on failure)
  cancel.ts                    cancelled outcomes, grace constant, pending-request helpers
  create-plan.ts               CURSOR_CREATE_PLAN_METHOD
  cursor-stream-extensions.ts  cursor/update_todos + cursor/task handlers
  fs.ts                        fs/read_text_file + fs/write_text_file with root policy
  map-update.ts                session/update -> AgentEvent, stopReason parsing
  runtime.ts                   createAcpRuntime (AgentRuntime)
  session.ts                   openAcpSession (initialize, authenticate, session/new)
  session-acp.ts               AcpSession class (handlers, prompt, close)
  session-client-requests.ts   handleClientRequest (park until handler or cancel)
  session-options.ts           ACP_CLIENT_CAPABILITIES, OpenAcpSessionOptions, extensionEnabled
  session-prompt.ts            streamPrompt async generator, toAcpBlock
  streams.ts                   peerFromProcess (web streams -> ndjson RpcPeer)
  task.ts                      cursor/task params + results
  update-todos.ts              cursor/update_todos params, mergeTodos, results
  profiles/
    index.ts                   profile exports
    types.ts                   AgentProfile, AgentCommand, AgentProbeResult
    cursor.ts                  cursorProfile, cursorCommand, probeCursor, constants
    generic.ts                 createGenericProfile
    place-mcp.ts               .cursor/mcp.json placement, ACP mcpServers mapping
    place-skills.ts            .cursor/skills/<slug>/SKILL.md placement
    probe.ts                   probeBinaryVersion, readStdout
  testing/
    index.ts                   testing exports
    fake-agent.ts              runFakeAgent (scripted ACP agent over streams)
    scripted-runner.ts         createScriptedProcessRunner (ProcessRunner over fake agent)
  session-test-helpers.ts      test-only helpers (withSession, setupSteps, collect)
  create-plan-test-helpers.ts  test-only helpers for plan-review inbox tests
  *.test.ts                    tests
```

## index.ts exports

| From              | Names                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask-question.ts   | `CURSOR_ASK_QUESTION_METHOD`                                                                                                                                                                                                                                                                                                                                                                                 |
| create-plan.ts    | `CURSOR_CREATE_PLAN_METHOD`                                                                                                                                                                                                                                                                                                                                                                                  |
| task.ts           | `CURSOR_TASK_METHOD`, `completedTaskResult`, `parseTaskParams`, `rejectedTaskResult`                                                                                                                                                                                                                                                                                                                         |
| update-todos.ts   | `CURSOR_UPDATE_TODOS_METHOD`, `acceptedUpdateTodosResult`, `mergeTodos`, `parseUpdateTodosParams`, `rejectedUpdateTodosResult`                                                                                                                                                                                                                                                                               |
| cancel.ts         | `CANCELLED_ASK_QUESTION_RESULT`, `CANCELLED_CREATE_PLAN_RESULT`, `CANCELLED_PERMISSION_RESULT`, `DEFAULT_CANCEL_GRACE_MS`                                                                                                                                                                                                                                                                                    |
| session.ts        | `ACP_CLIENT_CAPABILITIES`, `openAcpSession`, `type OpenAcpSessionOptions`                                                                                                                                                                                                                                                                                                                                    |
| fs.ts             | `attachFsHandlers`, `resolveUnderRoots`, `writeTextAtomic`, `type AcpFsOptions`                                                                                                                                                                                                                                                                                                                              |
| map-update.ts     | `mapSessionUpdate`, `parseStopReason`, `promptResultSchema`, `type StopReason`                                                                                                                                                                                                                                                                                                                               |
| runtime.ts        | `createAcpRuntime`, `type CreateAcpRuntimeOptions`                                                                                                                                                                                                                                                                                                                                                           |
| acp-log.ts        | `REDACTED`, `documentStoreAcpSink`, `logAcpMessage`, `loggingTransport`, `redactSecrets`, `type AcpLogSink`                                                                                                                                                                                                                                                                                                  |
| streams.ts        | `peerFromProcess`, `type PeerFromProcessOptions`                                                                                                                                                                                                                                                                                                                                                             |
| profiles/index.ts | `asMcpLaunchSpecs`, `cleanupPlacedMcp`, `cleanupPlacedSkills`, `createGenericProfile`, `CURSOR_AUTH_METHOD`, `CURSOR_MODES`, `CURSOR_SKILLS_DIR`, `cursorCommand`, `cursorProfile`, `FLOWS_MCP_KEY`, `GENERIC_MODES`, `placeMcp`, `placeSkills`, `probeBinaryVersion`, `probeCursor`, `toAcpMcpServers`, types `AgentCommand`, `AgentProbeResult`, `AgentProfile`, `GenericProfileSettings`, `McpLaunchSpec` |
| testing/index.ts  | `runFakeAgent`, `createScriptedProcessRunner`, types `FakeAgentClientRequest`, `FakeAgentExpect`, `FakeAgentHandle`, `FakeAgentNotification`, `FakeAgentReply`, `FakeAgentScript`, `FakeAgentStep`, `ScriptedProcessRunner`, `ScriptedSpawn`                                                                                                                                                                 |

`profiles/index.ts` additionally exports `CURSOR_ASK_QUESTION_METHOD`,
`CURSOR_CREATE_PLAN_METHOD`, `CURSOR_TASK_METHOD`,
`CURSOR_UPDATE_TODOS_METHOD` (re-exported from cursor.ts) and `readStdout`.
`session.ts` also exports `toAcpBlock`.

## Core types consumed

From `@workspace/core` (`ports/agent-runtime.ts`, `ports/process-runner.ts`):

- `ContentBlock` = `{type:"text",text}` | `{type:"resource",uri,mimeType?,text?}` | `{type:"resource_link",uri,name?,mimeType?}`.
- `SessionSpec` = `{ profileId, cwd, mode?, model?, effort?, mcpServers?: unknown[], skills?: Skill[], handlePermission?, handleAskQuestion?, handleCreatePlan? }` (handlers are `(params: unknown) => Promise<unknown>`).
- `AgentEvent` kinds: `message_chunk`/`thought_chunk {text}`, `tool_call {id,title,toolKind,status,input?}`, `tool_call_update {id,status,content?,input?,output?}`, `plan {entries: PlanEntry[]}`, `todos {entries: TodoEntry[]}`, `subagent {id,description,subagentType,durationMs?}`, `usage {used,size,cost?: {amount,currency}}`, `stop {reason}` with reason in `end_turn|max_tokens|max_turn_requests|refusal|cancelled`.
- `AgentSession { id; prompt(blocks, signal): AsyncIterable<AgentEvent>; setMode?(mode); close() }`.
- `AgentRuntime { profiles(); list(signal?); open(spec, signal) }`, `AgentProfileInfo { id, modes?, found?, version? }`.
- `ProcessRunner.spawn(spec: ProcessSpawnSpec, signal): RunningProcess` with `RunningProcess { pid, stdin: WritableStream, stdout/stderr: ReadableStream<Uint8Array>, exit: Promise<number>, sandboxed }`.
- `engineError(code, message, data?)`, `formatSkillMd({name,description,body})`, `Logger`, `DocumentStore`, `Skill { slug, name, description, body, ... }`.

## ACP wire protocol used

Transport: ndjson JSON-RPC 2.0 over the agent's stdin (client → agent) and
stdout (agent → client). The client is Flows.

| Direction | Method                       | Kind                    | Params / result                                                                                                             |
| --------- | ---------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| C→A       | `initialize`                 | request                 | `{ protocolVersion: 1, clientCapabilities: ACP_CLIENT_CAPABILITIES, clientInfo }`; result may contain `authMethods: [{id}]` |
| C→A       | `authenticate`               | request                 | `{ methodId }` (only when the profile's method is in `authMethods`)                                                         |
| C→A       | `session/new`                | request                 | `{ cwd, mcpServers }`; result `{ sessionId: string }`                                                                       |
| C→A       | `session/prompt`             | request                 | `{ sessionId, prompt: AcpBlock[] }`; result `{ stopReason }`                                                                |
| C→A       | `session/cancel`             | notification            | `{ sessionId }`                                                                                                             |
| A→C       | `session/update`             | notification            | `{ sessionId, update: { sessionUpdate, ... } }`                                                                             |
| A→C       | `session/request_permission` | request                 | parks; answered by `handlePermission` or `{ outcome: { outcome: "cancelled" } }`                                            |
| A→C       | `cursor/ask_question`        | request                 | Cursor ext; parks like permission                                                                                           |
| A→C       | `cursor/create_plan`         | request                 | Cursor ext; parks like permission                                                                                           |
| A→C       | `cursor/update_todos`        | request or notification | Cursor ext; answered immediately                                                                                            |
| A→C       | `cursor/task`                | request or notification | Cursor ext; answered immediately                                                                                            |
| A→C       | `fs/read_text_file`          | request                 | `{ sessionId, path, line?, limit? }` → `{ content }`                                                                        |
| A→C       | `fs/write_text_file`         | request                 | `{ sessionId, path, content }` → `{}`                                                                                       |

`ACP_CLIENT_CAPABILITIES = { fs: { readTextFile: true, writeTextFile: true }, terminal: false }`.
Default `clientInfo = { name: "flows", version: "0.0.0" }`; default
`protocolVersion = 1`.

## session-options.ts

```ts
export function extensionEnabled(
  extensions: Readonly<Record<string, unknown>> | undefined,
  method: string
): boolean
export const ACP_CLIENT_CAPABILITIES
export type OpenAcpSessionOptions = {
  cwd: string
  allowedRoots?: readonly string[]
  mcpServers?: readonly unknown[]
  logger?: Logger
  signal?: AbortSignal
  clientInfo?: { name: string; version: string }
  protocolVersion?: number
  authMethod?: string
  cancelGraceMs?: number
  kill?: () => void
  handlePermission?: (p: unknown) => Promise<unknown>
  handleAskQuestion?: (p: unknown) => Promise<unknown>
  handleCreatePlan?: (p: unknown) => Promise<unknown>
  extensions?: Readonly<Record<string, unknown>>
}
```

`extensionEnabled`: `extensions === undefined` → `true` (direct session tests
keep the Cursor handlers); otherwise `Boolean(extensions[method])`. So `{}`
(generic profile) attaches no Cursor extensions.

## session.ts — `openAcpSession(peer, options): Promise<AgentSession>`

1. `initialize` (with `options.signal`).
2. If `options.authMethod`: `authenticateIfRequired(peer, authMethod, initResult, signal)`.
3. `session/new` with `{ cwd: options.cwd, mcpServers: options.mcpServers ?? [] }`.
4. Result must have string `sessionId`, else throws
   `Error("session/new result missing sessionId")`.
5. Returns `new AcpSession(peer, sessionId, options)`.

## authenticate.ts

`authenticateIfRequired(peer, authMethod, initResult, signal?)`: collects
string `id`s from `initResult.authMethods` (array of objects; anything else →
none). If `authMethod` is not listed, returns without calling. Otherwise
`peer.request("authenticate", { methodId: authMethod }, { signal })`; any
failure throws `engineError("needs_trust", "Agent authentication failed (<authMethod>)", { authMethod, cause: <Error.message or raw> })`.

## session-acp.ts — `class AcpSession implements AgentSession`

Constructor `(peer, id, options)`:

- `cancelGraceMs = options.cancelGraceMs ?? 5000`; keeps `kill`, `logger`,
  the three handlers; `pending = new Set<PendingClientRequest>()`;
  `todos: TodoEntry[] = []`; `emitter = {}`.
- Always registers `session/request_permission` →
  `handleClientRequest(scope, params, handlePermission, CANCELLED_PERMISSION_RESULT, "session/request_permission")`.
- If `extensionEnabled(ext, "cursor/ask_question")`: registers it with
  `handleAskQuestion` / `CANCELLED_ASK_QUESTION_RESULT`.
- If enabled `"cursor/create_plan"`: same with `handleCreatePlan` /
  `CANCELLED_CREATE_PLAN_RESULT`.
- If enabled `"cursor/update_todos"` **or** `"cursor/task"`:
  `attachCursorStreamExtensions(peer, { getTodos, setTodos, emit: e => emitter.emit?.(e) })`
  (registers both methods, as request and notification).
- Always `attachFsHandlers(peer, { sessionId: id, allowedRoots: options.allowedRoots ?? [options.cwd] })`.

`prompt(blocks, signal)`: throws `Error("ACP session is closed")` when closed;
otherwise returns `streamPrompt({ peer, sessionId, pending, cancelGraceMs, kill, logger, emitter }, blocks, signal)`.
No `setMode` implementation.

`close()`: idempotent; marks closed, answers all pending client requests with
their cancelled result, unregisters every handler, `peer.close()`.

## session-client-requests.ts

`handleClientRequest(scope: {sessionId, pending}, params, handler, cancelledResult, method): Promise<unknown>`

- If `params` is an object with a `sessionId` key that differs from the
  session: rejects with `Error("<method> wrong session")` (becomes a JSON-RPC
  error to the agent). Missing `sessionId` is accepted.
- Otherwise returns a promise; adds `{ resolve, cancelledResult }` to
  `pending`. Without a handler it parks until cancel/close. With a handler,
  the handler's result (or error) settles the promise only if the entry is
  still in `pending` (i.e. cancel did not answer first); the entry is then
  removed.

## cancel.ts

| Export                                      | Value                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DEFAULT_CANCEL_GRACE_MS`                   | `5_000`                                                                                                                            |
| `CANCELLED_PERMISSION_RESULT`               | `{ outcome: { outcome: "cancelled" } }`                                                                                            |
| `CANCELLED_ASK_QUESTION_RESULT`             | same shape                                                                                                                         |
| `CANCELLED_CREATE_PLAN_RESULT`              | same shape                                                                                                                         |
| `type PendingClientRequest`                 | `{ resolve(result), cancelledResult }`                                                                                             |
| `type PendingPermission`                    | deprecated alias                                                                                                                   |
| `cancelPendingRequests(set)`                | resolve each with its `cancelledResult`, clear                                                                                     |
| `cancelPendingPermissions(set)`             | alias of the above                                                                                                                 |
| `scheduleCancelKill(graceMs, isDone, kill)` | no-op clear fn if `!kill` or `graceMs <= 0`; else `setTimeout(graceMs)` calling `kill()` if `!isDone()`; returns `clearTimeout` fn |

## session-prompt.ts

`toAcpBlock(block)`: non-resource blocks pass through unchanged. Resource →
`{ type: "resource", resource: { uri, text: block.text ?? "", mimeType? (only if truthy) } }`.

`streamPrompt(scope, blocks, signal): AsyncGenerator<AgentEvent>`:

- Sets `scope.emitter.emit = pushEvent` (Cursor todo/task extensions emit
  into the active prompt). Restored to `undefined` in `finally` only if still
  ours.
- Abort handling (`onAbort`, once): notify `session/cancel { sessionId }`,
  answer all pending client requests with their cancelled outcome, schedule
  `kill` after `cancelGraceMs` unless the prompt settled. If the signal is
  already aborted it runs immediately (before the prompt is sent).
- Subscribes to `session/update`: skip when `params.sessionId` exists and
  differs; `mapSessionUpdate(params, logger)`; push non-null events.
- Sends `session/prompt { sessionId, prompt: blocks.map(toAcpBlock) }`
  **without** passing `signal` (ACP cancel is `session/cancel`, not
  `$/cancel_request`). On success parse `stopReason` (throws if missing) and
  record `{ kind: "stop", reason }`; on error record the error. Either way
  mark settled, clear the kill timer, wake.
- Loop: yield queued events; when settled drain remaining queue and break;
  else wait for a wake.
- After loop: on error, if cancel had started yield `{ kind: "stop", reason: "cancelled" }` and return; else rethrow. On success yield the stop event.
- `finally`: remove abort listener, clear kill timer, unsubscribe.

## map-update.ts

`mapSessionUpdate(params, logger?)` → `AgentEvent | null`. Envelope must be
`{ sessionId: string, update: { sessionUpdate: string, ...passthrough } }`,
else warn `"ACP session/update missing sessionId or update"` `{ params }`.

| `sessionUpdate`       | Result                                                                                                                                            | Null + warn message when invalid                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `agent_message_chunk` | `{kind:"message_chunk", text: content.text}` (content must be `{type:"text",text}`)                                                               | `"ACP agent_message_chunk without text content"`                                     |
| `agent_thought_chunk` | `{kind:"thought_chunk", text}`                                                                                                                    | `"ACP agent_thought_chunk without text content"`                                     |
| `tool_call`           | `{kind:"tool_call", id: toolCallId, title, toolKind: kind ?? "other", status: status ?? "pending", input: rawInput (omitted if null/undefined)}`  | missing/empty `toolCallId` or `title`: `"ACP tool_call missing toolCallId or title"` |
| `tool_call_update`    | `{kind:"tool_call_update", id, status: status ?? "pending", content?, input? (rawInput), output? (rawOutput)}` (each omitted when null/undefined) | `"ACP tool_call_update missing toolCallId"`                                          |
| `plan`                | `{kind:"plan", entries}`; entries `[{content, status?, priority?}]`                                                                               | `"ACP plan missing entries"`                                                         |
| `usage_update`        | `{kind:"usage", used, size, cost?}`; cost included only if `{amount:number,currency:string}`                                                      | `"ACP usage_update missing used or size"`                                            |
| other                 | null                                                                                                                                              | `"ignoring unknown ACP session update kind"` `{ sessionUpdate }`                     |

Non-string `kind`/`status` fall back to the defaults. All warnings pass
`{ update }` as data (except unknown kind).

`promptResultSchema = z.object({ stopReason: z.enum(["end_turn","max_tokens","max_turn_requests","refusal","cancelled"]) })`.
`parseStopReason(result)` throws `Error("session/prompt result missing stopReason")` on parse failure.

## cursor-stream-extensions.ts

`attachCursorStreamExtensions(peer, { getTodos, setTodos, emit }): () => void`
registers `cursor/update_todos` and `cursor/task` both as request handlers
(return value is the response) and notification handlers (result discarded).

- update_todos: `parseUpdateTodosParams`; null → `rejectedUpdateTodosResult("invalid params")`. Else `next = mergeTodos(getTodos(), todos, merge)`, `setTodos(next)`, `emit({ kind: "todos", entries: next })`, return `acceptedUpdateTodosResult(next)`. Todos are session-scoped (persist across prompts).
- task: `parseTaskParams`; null → `rejectedTaskResult("invalid params")`. Else emit `{ kind: "subagent", id: toolCallId, description, subagentType, durationMs? }` and return `completedTaskResult({ agentId?, durationMs? })`.
- Emission is dropped when no prompt is active (`emitter.emit` unset).

## update-todos.ts

- `CURSOR_UPDATE_TODOS_METHOD = "cursor/update_todos"`.
- Params schema: `{ toolCallId: string min1, todos: [{ id: min1, content: min1, status: "pending"|"in_progress"|"completed"|"cancelled" }], merge: boolean }`. `parseUpdateTodosParams` returns `{ toolCallId, todos, merge }` or null (extra todo keys dropped).
- `mergeTodos(existing, incoming, merge)`: `merge=false` → copies of `incoming`. `merge=true` → keep existing order with each id replaced by the incoming version, then append incoming entries whose ids were not in `existing`, in incoming order (duplicate new ids in one update are appended each time).
- `acceptedUpdateTodosResult(todos)` → `{ outcome: { outcome: "accepted", todos: copies } }`.
- `rejectedUpdateTodosResult(reason?)` → `{ outcome: { outcome: "rejected", reason? } }`.

## task.ts

- `CURSOR_TASK_METHOD = "cursor/task"`.
- Params: `{ toolCallId: min1, description: min1, prompt?, subagentType: string min1 | { custom: string min1 }, model?, agentId?, durationMs?: number >= 0 }`.
- `parseTaskParams` → `TaskParams` with `subagentType` normalised to a string (the `custom` value); optional keys only when defined; null on failure.
- `completedTaskResult({agentId?, durationMs?})` → `{ outcome: { outcome: "completed", agentId?, durationMs? } }`.
- `rejectedTaskResult(reason?)` → `{ outcome: { outcome: "rejected", reason? } }`.

`ask-question.ts` exports `CURSOR_ASK_QUESTION_METHOD = "cursor/ask_question"`
and re-exports `CANCELLED_ASK_QUESTION_RESULT`; `create-plan.ts` exports
`CURSOR_CREATE_PLAN_METHOD = "cursor/create_plan"` and re-exports
`CANCELLED_CREATE_PLAN_RESULT`. Parsing of those params and the Inbox
mapping live in core (`handleAskQuestion` / `handleCreatePlan` handlers are
supplied by the engine through `SessionSpec`).

## fs.ts — ACP file-system path policy

```ts
export type AcpFsOptions = {
  sessionId: string
  allowedRoots: readonly string[]
}
export async function resolveUnderRoots(
  path: string,
  allowedRoots: readonly string[]
): Promise<string>
export async function writeTextAtomic(
  path: string,
  content: string
): Promise<void>
export function attachFsHandlers(
  peer: RpcPeer,
  options: AcpFsOptions
): () => void
```

All denials throw `JsonRpcResponseError({ code: -32602, message })`.

`resolveUnderRoots`:

1. Non-absolute path → `"fs path must be absolute: <path>"`.
2. No roots → `"no allowed filesystem roots"`.
3. `lexical = path.resolve(path)`. Root forms = each root resolved **plus**
   each root's `realpath` (handles macOS `/var` → `/private/var`). A root whose
   realpath fails makes the call reject with the fs error.
4. Lexical path must equal a root form or start with `<root>/`, else
   `"path outside allowed roots: <path>"`.
5. Realpath the longest existing prefix and rejoin missing trailing
   segments; reaching `/` without success → `"cannot resolve path: <abs>"`.
6. The real path must also be under a root form (blocks symlink escapes),
   else `"path outside allowed roots: <path>"`. Returns the real path.

`writeTextAtomic`: `mkdir -p dirname`; temp file in the same directory named
`.<Date.now()>-<8 hex chars from randomBytes(4)>.tmp`; write utf8; `rename`
over the target; on failure unlink the temp (ignored) and rethrow.

Handlers:

| Method               | Params schema                                                                | Errors                                                                                   | Result                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `fs/read_text_file`  | `{ sessionId: string, path: string min1, line?: int > 0, limit?: int >= 0 }` | `"invalid fs/read_text_file params: <zod message>"`, `"fs/read_text_file wrong session"` | `{ content }`; if `line`/`limit` given: split on `\n`, slice `[line-1 (or 0), start+limit)`, join with `\n` |
| `fs/write_text_file` | `{ sessionId, path min1, content: string }`                                  | `"invalid fs/write_text_file params: ..."`, `"fs/write_text_file wrong session"`         | `{}` after `writeTextAtomic`                                                                                |

Read errors from `readFile` (e.g. ENOENT) propagate as the protocol's
internal error.

## acp-log.ts

- `REDACTED = "[REDACTED]"`.
- `type AcpLogSink = { append(line: string): void }`.
- `documentStoreAcpSink(docs, path)`: `append` reads the doc text (or `""`),
  writes `prev + line + "\n"` (read-modify-write whole file). Used for
  `runs/<id>/steps/<step>/acp.ndjson`.
- `redactSecrets(value, secrets)`: drops empty secrets; if none remain,
  returns value unchanged. Deep walk (arrays, plain objects, strings); each
  occurrence of each secret in a string replaced by `[REDACTED]`, in list
  order.
- `logAcpMessage(sink, message, secrets = [])`: `sink.append(JSON.stringify(redactSecrets(message)))`.
- `loggingTransport(inner, sink, secrets = [])`: wraps a `Transport`; logs
  every sent message before sending and every received message before
  delivering. `onClose`/`close` pass through.

## streams.ts

`peerFromProcess(proc, { acpLog?, secrets? }?)`: converts
`proc.stdout` with `Readable.fromWeb` and `proc.stdin` with
`Writable.fromWeb`, builds `ndjsonTransport(stdout, stdin)`, wraps it in
`loggingTransport` when `acpLog` is set, returns `new RpcPeer(transport)`.
Stderr is not read.

## runtime.ts — `createAcpRuntime(options): AgentRuntime`

```ts
export type CreateAcpRuntimeOptions = {
  processRunner: ProcessRunner
  profiles?: readonly AgentProfile[] // default [cursorProfile]
  logger?: Logger
  clientInfo?: { name: string; version: string }
  env?: Readonly<Record<string, string | undefined>>
  acpLog?: AcpLogSink
  secrets?: readonly string[]
}
```

- `profiles()` → `[{ id, modes: capabilities.modes }]` (no probing).
- `list(signal = new AbortController().signal)` → sequentially `profile.probe(processRunner, signal, options.env)`; returns `{ id, modes, found, version }` per profile.
- `open(spec, signal)`:
  1. Unknown `spec.profileId` → `engineError("not_found", "Unknown agent profile: <id>")`.
  2. If `spec.skills?.length`: `await profile.placeSkills(skills, spec.cwd)`.
  3. `launches = asMcpLaunchSpecs(spec.mcpServers)`; if non-empty and the
     profile has `placeMcp`: `await profile.placeMcp(launches, spec.cwd)`.
  4. `command = profile.command(spec)`.
  5. Own `AbortController procCtl` mirrored from `signal` (abort with its
     reason; immediately if already aborted).
  6. `processRunner.spawn({ command: cmd, args, cwd: spec.cwd, env: { ...process.env, ...options.env, ...command.env } }, procCtl.signal)`. No `sandbox` is set here.
  7. `peer = peerFromProcess(proc, { acpLog, secrets })`.
  8. `mcpForSession = capabilities.mcpParam ? toAcpMcpServers(launches) : []`.
  9. `openAcpSession(peer, { cwd, mcpServers: mcpForSession, logger, signal, clientInfo, authMethod: profile.authMethod, kill: () => procCtl.abort(), extensions: profile.extensions, handlePermission?, handleAskQuestion?, handleCreatePlan? })`.
  10. On success return a wrapper session (same `id`, `prompt`, `setMode`
      bound if present) whose `close()` closes the inner session then
      `peer.close()`, `procCtl.abort()`, `await profile.cleanup?.(cwd)`
      (in `finally`).
  11. On failure: `peer.close()`, `procCtl.abort()`, `profile.cleanup?.(cwd)`,
      rethrow.

`spec.mode`, `spec.effort` are not used by the runtime.

## profiles/types.ts

```ts
export type AgentCommand = {
  cmd: string
  args: string[]
  env: Record<string, string | undefined>
}
export type AgentProbeResult = { found: boolean; version: string | null }
export type AgentProfile = {
  id: string
  command(spec: SessionSpec): AgentCommand
  authMethod?: string
  capabilities: { mcpParam: boolean; setModel: boolean; modes: string[] }
  placeSkills(skills: readonly Skill[], workDir: string): Promise<void>
  placeMcp?(servers: readonly McpLaunchSpec[], workDir: string): Promise<void>
  cleanup?(workDir: string): Promise<void>
  extensions: Record<string, unknown>
  probe(
    runner: ProcessRunner,
    signal: AbortSignal,
    env?: Readonly<Record<string, string | undefined>>
  ): Promise<AgentProbeResult>
}
```

## profiles/cursor.ts

| Export                              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CURSOR_AUTH_METHOD`                | `"cursor_login"`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `CURSOR_MODES`                      | `["agent", "ask", "plan"]`                                                                                                                                                                                                                                                                                                                                                                                                              |
| `cursorCommand(spec)`               | `{ cmd: "agent", args: [...(spec.model ? ["--model", model] : []), "acp"], env: {} }`                                                                                                                                                                                                                                                                                                                                                   |
| `probeCursor(runner, signal, env?)` | `probeBinaryVersion(runner, "agent", signal, { env })`                                                                                                                                                                                                                                                                                                                                                                                  |
| `cursorProfile`                     | `id: "cursor"`, `command: cursorCommand`, `authMethod: "cursor_login"`, `capabilities: { mcpParam: true, setModel: false, modes: ["agent","ask","plan"] }`, `placeSkills` → place-skills, `placeMcp` → place-mcp, `cleanup(workDir)` → `cleanupPlacedSkills` then `cleanupPlacedMcp`, `extensions: { "cursor/ask_question": true, "cursor/create_plan": true, "cursor/update_todos": true, "cursor/task": true }`, `probe: probeCursor` |

Also re-exports the four `CURSOR_*_METHOD` constants.

## profiles/generic.ts

`GENERIC_MODES = ["agent"]`.

```ts
export type GenericProfileSettings = {
  command: string
  args?: readonly string[]
  env?: readonly string[]
  authMethod?: string
  id?: string
  modes?: readonly string[]
  logger?: Logger
}
export function createGenericProfile(
  settings: GenericProfileSettings
): AgentProfile
```

- `id` default `"generic"`; logs `info("ACP generic profile ignores extensions", { profileId })` once at creation.
- `command()` (ignores the spec): `{ cmd: settings.command, args: copy, env }`
  where `env[name] = process.env[name]` for each listed name (read at call
  time; undefined values kept as undefined keys).
- `authMethod` only when set. `capabilities: { mcpParam: true, setModel: false, modes }`.
- `placeSkills` is a no-op; no `placeMcp`, no `cleanup`; `extensions: {}`.
- `probe` → `probeBinaryVersion(runner, settings.command, signal, { env })`.

## profiles/probe.ts

- `readStdout(proc)`: read the whole stdout web stream, await `proc.exit`,
  decode UTF-8 → `{ text, exitCode }`.
- `probeBinaryVersion(runner, bin, signal, { args = ["--version"], env }?)`:
  spawn `{ command: bin, args, env }` (no cwd), close stdin (errors ignored),
  read stdout. Non-zero exit → `{ found: false, version: null }`. Version =
  first line of trimmed stdout, trimmed; empty → not found. Any throw →
  not found.

## profiles/place-mcp.ts

```ts
export type McpLaunchSpec = {
  command: string
  args?: readonly string[]
  env?: Readonly<Record<string, string>>
}
export const FLOWS_MCP_KEY = "flows"
```

- File: `<workDir>/.cursor/mcp.json`. Module-level `Map<workDir, { path, previous: string | null }>`.
- `placeMcp(servers, workDir)`: uses only `servers[0]` (no-op if empty).
  Reads the prior content (null if unreadable). Writes
  `JSON.stringify({ mcpServers: { flows: { command, args: [...], env? } } }, null, 2) + "\n"`;
  `env` only when non-empty. `mkdir -p <workDir>/.cursor`. Records the
  placement (a second call overwrites the record, so the original backup is
  lost).
- `cleanupPlacedMcp(workDir)`: no record → no-op. Previous null → unlink
  (ignore errors); else rewrite previous content.
- `toAcpMcpServers(servers)`: `[{ name: i === 0 ? "flows" : "mcp-<i>", type: "stdio", command, args: [...], env: [{ name, value }] }]`.
- `asMcpLaunchSpecs(servers)`: skip non-objects and entries without a
  non-empty string `command`; `args` = string items of an array (else
  undefined); `env` accepts a `Record<string,string>` (non-string values
  dropped) **or** an array of `{ name, value }` strings; anything else →
  undefined.

## profiles/place-skills.ts

- `CURSOR_SKILLS_DIR = ".cursor/skills"`.
- `placeSkills(skills, workDir)`: for each skill, folder
  `<workDir>/.cursor/skills/<slug>`, file `SKILL.md`. Records whether the
  folder existed and the previous file text (or null), writes
  `formatSkillMd({ name, description, body })` (core: YAML front matter +
  body). Module-level `Map<workDir, placements[]>` replaced on each call.
- `cleanupPlacedSkills(workDir)`: for each placement: previous null → `rm`
  the file (ignore errors) and, if the folder did not exist before,
  `rm -rf` the folder; else `mkdir -p` and restore the previous text.

## testing/fake-agent.ts — `runFakeAgent(script, readable, writable)`

Plays the agent side of an ACP script over ndjson streams.

Types (all exported):

```ts
FakeAgentExpect        = { method: string; params?: unknown; notification?: boolean }
FakeAgentNotification  = { method: string; params?: unknown }
FakeAgentClientRequest = { method: string; params?: unknown; expectResult?: unknown;
                           expectError?: true | { code?: number; messageIncludes?: string } }
FakeAgentReply         = { result: unknown } | { error: JsonRpcErrorObject }
FakeAgentStep          = { expect; reply?; hold?: boolean; notifications?: FakeAgentNotification[];
                           notifyBefore?: boolean; clientRequests?: FakeAgentClientRequest[];
                           replyHeld?: { method: string; reply: FakeAgentReply } }
FakeAgentScript        = { steps: readonly FakeAgentStep[]; waitForClose?: boolean }
FakeAgentHandle        = { done: Promise<void>; requestClient(req): Promise<void>; close(): void }
```

Semantics:

- Inbound requests/notifications are matched to `steps[stepIndex]` in order.
  Params compared by stable (key-sorted) JSON stringification when
  `expect.params` is set.
- Errors (all reject `done` and close the transport):
  - `fake-agent: unexpected <request|notification> <method> after script ended`
  - `fake-agent step <i>: expected <notification|request> <m>, got <request|notification> <method>`
  - `fake-agent step <i>: expected method <m>, got <method>`
  - `fake-agent step <i>: params mismatch for <m>`
  - `fake-agent step <i>: request <m> needs reply or hold`
  - `fake-agent: no held request for <method>`
- Step application order: notifications first if `notifyBefore`; send
  `clientRequests` (client request ids start at 1 and increment); if
  `replyHeld`, reply to the held request of that method; then for a request:
  `hold` stores the id by method (and if `reply` is also set and this step
  sent client requests with expectations, reply once those expectations
  resolve, then emit notifications, then try finishing); else `reply` sends
  it. Notifications are sent after the reply unless `notifyBefore`.
- Client request expectations: the expect entry is registered before sending
  (synchronous "method not found" replies). `expectError: true` accepts any
  error; object form checks `code` and `message.includes`. Failure messages:
  `client request <id> expected error, got result`, `... error code <c>, want <w>`,
  `... error message mismatch`, `... returned error`, `... result mismatch`.
  A request without expectations is fire-and-forget.
- `done` resolves when all steps ran, no client expectations are pending, and
  all expectation promises resolved — unless `waitForClose`, in which case
  `close()` triggers that wait. Transport close before the end rejects with
  `fake-agent: closed after <n>/<total> steps`; transport error rejects.
- `requestClient(req)` rejects `fake-agent: already settled` after settle.

## testing/scripted-runner.ts

```ts
export type ScriptedSpawn = { spec: ProcessSpawnSpec; script: FakeAgentScript }
export type ScriptedProcessRunner = ProcessRunner & {
  readonly spawns: readonly ScriptedSpawn[]
}
export function createScriptedProcessRunner(
  resolveScript: (spec) => FakeAgentScript
): ScriptedProcessRunner
```

Each `spawn` records `{ spec, script }`, runs `runFakeAgent` over two
`PassThrough` streams, returns `{ pid: 20001, 20002, ..., stdin: Writable.toWeb, stdout: Readable.toWeb, stderr: empty stream, exit, sandboxed: spec.sandbox !== undefined }`.
`exit` resolves 0 when `done` resolves, 1 when it rejects or on abort
(abort closes the agent and destroys both streams).

## Test helpers (not exported)

- `session-test-helpers.ts`: `clientInfo = { name: "flows-test", version: "0.0.0" }`, `sessionId = "sess_test"`, `cwd = "/tmp/work"`, `updateNote(update)`, `setupSteps(promptStep)` (initialize + session/new + prompt), `collect(iter)`, `withSession(script, run, opts)`.
- `create-plan-test-helpers.ts`: plan-review fixtures (`planParams` with `toolCallId: "call_124"`, todos), `seedAskRun()` (fake event store run `r1` with an `llm` node `planReview: "ask"`), `wirePlanReviewInbox(...)` linking core `createPlanReviewGate` and `createInboxService`, `waitFor(fn, 2000)`.

## Tests — behaviours pinned

- Each `session/update` kind maps as in the table; unknown kinds are logged and skipped; `parseStopReason` throws without `stopReason`.
- `toAcpBlock` nests resource fields under `resource`.
- Abort sends `session/cancel`, answers a parked permission `cancelled`, stream ends with `stop: cancelled`; if the agent ignores cancel, `kill` runs after `cancelGraceMs`.
- fs: read/write inside the work dir (atomic); `..` escape and symlink escape rejected with JSON-RPC errors; nested files created.
- Runtime: `profiles()` static cursor info; `list()` found/missing + version; spawns `agent [--model m] acp` with `cwd` = step work dir; authenticates with `cursor_login` only when advertised; auth failure → `needs_trust`; `.cursor/mcp.json` written before `session/new`.
- Generic profile: no Cursor extension handlers registered (Cursor ext requests get "method not found"); command env forwards named host vars.
- Permission/ask/plan inbox flows (with core gates): parked request → Inbox item → answer → agent continues; cancel answers `cancelled`; plan review `auto` accepts without an item.
- `update_todos` merge/replace semantics; accepted as notification too; `task` becomes a `subagent` event.
- `placeSkills` writes only selected skills, cleanup preserves pre-existing ones and restores prior file text; `placeMcp` deletes a new file or restores prior content.
