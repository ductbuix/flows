---
id: DES-041
title: Engine core, ports and the ACP agent runtime
type: design
status: draft
summary: Inside packages/core; Engine facade, contexts, ports, run actors, node executors, ACP agent sessions, permission policy and the MCP gateway.
tags: [engine, acp, cursor, ports, runs, agents, mcp, design]
related:
  [DES-034, DES-035, DES-038, DES-039, DES-040, DES-042, DES-019, DES-006]
updated: 2026-11-24
---

# Engine core, ports and the ACP agent runtime

## Public surface

```ts
export function createEngine(deps: EngineDeps, plugins?: EnginePlugin[]): Engine

export interface Engine {
  // one service per bounded context (DES-039)
  docket: DocketService
  workflows: WorkflowService
  runs: RunService
  inbox: InboxService
  library: LibraryService
  connectors: ConnectorService
  skills: SkillService
  files: FileService
  agents: AgentService
  settings: SettingsService
  updates: UpdateBus // typed stream that FCP turns into */update
  start(): Promise<void> // recover runs, build projections, start watchers
  stop(signal?: AbortSignal): Promise<void>
}

export function bindEngine(
  engine: Engine,
  peer: RpcPeer,
  ctx: ClientContext
): Disposable
```

`createEngine` is the **composition root inside core**: it wires services
to ports and registries. Hosts only build `EngineDeps` (adapters) and
choose plugins. No DI container; plain objects and factory functions.

## Module layout

```
packages/core/src/
  kernel/        result, errors, ids, clock, update bus, event bus, actor
  ports/         one file per port (interfaces only)
  docket/        model.ts  service.ts  rank.ts  index.ts (projection)
  workflows/     model.ts  service.ts  validate.ts
  runs/          model.ts  service.ts  decide.ts  fold.ts  actor.ts  scheduler.ts
  nodes/         registry.ts  kinds/{trigger,asset,llm,condition,approval,notify}.ts
  agents/        service.ts  permission-policy.ts  session-driver.ts
  inbox/         projection.ts  service.ts
  library/       service.ts  providers.ts (data descriptors)  versions.ts
  connectors/    service.ts  capabilities.ts
  skills/        catalog.ts  placement.ts
  files/         service.ts
  rpc/           bind.ts (method table to services), update-mapper.ts
  testing/       in-memory fakes of every port + contract suites
  index.ts       createEngine, bindEngine, types
```

Each context folder exposes only `service.ts` types through `index.ts`;
other contexts import its service interface or listen to its domain events.

## Ports

A port exists only when there are two implementations: the real adapter
and the in-memory fake in `core/testing`.

| Port               | Contract (abridged)                                                                   | Node adapter                        |
| ------------------ | ------------------------------------------------------------------------------------- | ----------------------------------- |
| `EventStore`       | `append(runId, events, {expectSeq})`, `read(runId, fromSeq)`, `tail()`                | SQLite `events` table               |
| `DocumentStore`    | `read(path) -> {text, hash}`, `write(path, text, {baseHash})`, `list(glob)`, `remove` | fs + atomic rename                  |
| `FileWatcher`      | `watch(globs, onChange) -> Disposable`                                                | `fs.watch` / chokidar               |
| `BlobStore`        | `put(scope, stream) -> BlobRef`, `open(id) -> stream`                                 | files under scoped folders          |
| `ProcessRunner`    | `spawn(spec, signal) -> {stdin, stdout, stderr, exit}` in own group                   | `child_process` + sandbox-exec      |
| `AgentRuntime`     | `profiles()`, `open(SessionSpec, signal) -> AgentSession`                             | `agent-acp`                         |
| `ConnectorRuntime` | `call(connectorId, capability, args, signal)`, `check(id)`                            | MCP client, HTTP, CLI per transport |
| `SecretStore`      | `get/set/delete(key)`                                                                 | macOS keychain, `secrets/`          |
| `Clock`, `Ids`     | `now()`, `id(prefix)`                                                                 | system                              |
| `Logger`           | structured `child(bindings)`                                                          | pino-style to `logs/engine.log`     |

## Run engine

Kept from DES-034: append-then-act, state is a fold over events, loops
with back edges and a limit. New is how the work is split.

- **Functional core.** `decide(state, input) -> { events, effects }` is
  pure. `fold(state, event) -> state` is pure. All rules (ready nodes,
  limits, branches, loop counts, retry) live here and are unit tested
  without I/O.
- **Imperative shell: one `RunActor` per live run.** An actor owns a
  mailbox (inputs: `start`, `effect_result`, `answer`, `cancel`,
  `agent_event`) and processes one input at a time: decide, append
  events, then run effects. No locks; no two writers of one run.
- **Effects** are data (`launch_step`, `open_agent_session`,
  `post_inbox`, `write_output`, `notify`), executed by the shell through
  ports, and their results come back as inputs. Crash recovery replays
  events, then re-issues effects whose result event is missing
  (idempotent by step attempt id).
- **Scheduler** decides which actors may launch steps under global limits
  (`agents.maxConcurrent`) and per-workflow queues (DES-021). It is a pure
  policy object fed by actor requests.

Run states: `queued`, `running`, `waiting` (approval, permission or
question), then `done`, `failed` or `cancelled` (DES-003).

## Node executors (Strategy + Registry)

Node kinds from the mockup: `trigger`, `asset`, `llm`, `condition`,
`approval`, `notify`. Each is one module registered in the node registry
(DES-035), now with a single executor contract:

```ts
interface NodeKind<S> {
  kind: string
  settings: ZodType<S> // also drives the settings form
  ports: { in: PortSpec[]; out: PortSpec[] } // text | image | any
  execute(ctx: StepContext<S>): AsyncIterable<StepEvent>
}
```

`StepContext` gives inputs (files from upstream ports), the run folder,
an `AbortSignal`, and capabilities instead of raw ports:
`ctx.agent.session(...)`, `ctx.inbox.ask(...)`, `ctx.outputs.write(...)`.
Plugins add kinds with `EnginePlugin.nodeKinds`.

| Kind        | Executes as                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `trigger`   | emits card fields and run inputs as files                                   |
| `asset`     | resolves a Library item version or card asset; or writes one from its input |
| `llm`       | ACP session, mode `agent`, with allowed connectors and skills               |
| `condition` | ACP session, mode `ask` (read only); answer parsed to a named branch        |
| `approval`  | posts an Inbox approval; waits; branch by decision, note kept               |
| `notify`    | posts a notice (DES-016 notices table) and optional connector write         |

## Agent runtime over ACP

`packages/agent-acp` implements `AgentRuntime` with the JSON-RPC peer
from `packages/protocol` over the agent's stdio.

```ts
interface AgentSession {
  readonly id: string
  prompt(blocks: ContentBlock[], signal: AbortSignal): AsyncIterable<AgentEvent>
  setMode?(mode: string): Promise<void>
  close(): Promise<void>
}
type AgentEvent =
  | { kind: "message_chunk" | "thought_chunk"; text: string }
  | {
      kind: "tool_call"
      id: string
      title: string
      toolKind: string
      status: string
    }
  | { kind: "tool_call_update"; id: string; status: string; content?: unknown }
  | { kind: "plan" | "todos"; entries: PlanEntry[] }
  | { kind: "usage"; used: number; size: number; cost?: Money }
  | {
      kind: "stop"
      reason:
        | "end_turn"
        | "max_tokens"
        | "max_turn_requests"
        | "refusal"
        | "cancelled"
    }
```

Session flow per step:

1. Spawn the profile command through `ProcessRunner` (sandboxed, cwd =
   step work dir). For Cursor: `agent [--api-key ...] acp`.
2. `initialize` with `clientCapabilities`:
   `fs.readTextFile` and `fs.writeTextFile` **true** (all agent file I/O
   goes through our path policy), `terminal` false at first (the agent's
   own shell runs inside the sandbox).
3. `authenticate` with the profile's method (`cursor_login`) when the
   agent asks for it; failure maps to `needs_trust`/sign-in Inbox item.
4. `session/new {cwd, mcpServers}`; `mcpServers` holds only the Flows
   MCP gateway (below). Mode from the node kind (`agent`, `ask`, `plan`).
5. `session/prompt` with the node prompt plus `resource` blocks for input
   files. `session/update` notifications map 1:1 to `AgentEvent`s, which
   the actor logs and forwards as `run/update`.
6. `session/cancel` on run cancel or timeout; pending permission requests
   are answered `cancelled`, as ACP requires.

### Agent profiles (Strategy)

```ts
interface AgentProfile {
  id: "cursor" | string
  command(spec: SessionSpec): { cmd: string; args: string[]; env: Env }
  authMethod?: string
  capabilities: { mcpParam: boolean; setModel: boolean; modes: string[] }
  placeSkills(skills: Skill[], workDir: string): Promise<void>
  placeMcp?(servers: McpServer[], workDir: string): Promise<void>
  extensions: Record<string, ExtensionHandler> // e.g. "cursor/ask_question"
}
```

Cursor specifics, each behind a profile flag so a gap is one switch:

| Concern               | Cursor profile                                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model and effort      | `--model` at spawn (one session per step), until a set-model call exists                                                                                                                                                                                                                    |
| MCP servers           | `mcpParam: true` — live probe (`scripts/probe-acp-mcp.mjs`, agent `2026.11.22-e9042b2`) showed `session/new` `mcpServers` with `type: "stdio"` and `env` as `{name,value}[]` is honoured (tool ran). `placeMcp` still writes work-dir `.cursor/mcp.json` with only the Flows gateway entry. |
| Skills                | `placeSkills` copies the node's skills into the work dir `.cursor/` layout                                                                                                                                                                                                                  |
| `cursor/ask_question` | becomes an Inbox **question** item; answer returns `answered`/`skipped`                                                                                                                                                                                                                     |
| `cursor/create_plan`  | node setting `planReview`: `auto` accepts, `ask` makes an Inbox item                                                                                                                                                                                                                        |
| `cursor/update_todos` | `todos` run update (merge flag honoured)                                                                                                                                                                                                                                                    |
| `cursor/task`         | subagent trace row under the step                                                                                                                                                                                                                                                           |

A `generic` ACP profile (spec methods only, no extensions) lets other
ACP agents run with no new code; a `spawn` profile wraps today's
`cli-adapters.ts` for non-ACP CLIs during migration.

## Permission policy (Chain of Responsibility)

Every `session/request_permission`, every `fs/write_text_file` and every
gateway tool call passes one chain. The first rule that decides wins.

| Order | Rule                 | Decides                                                            |
| ----- | -------------------- | ------------------------------------------------------------------ |
| 1     | Path policy          | writes outside the step work dir or card assets: reject            |
| 2     | Connector capability | write capability off (mockup default): reject; on: continue        |
| 3     | Node allowlist       | tool or kind listed on the node: `allow_once`                      |
| 4     | Remembered answer    | an earlier `allow_always` for this workflow and tool: allow        |
| 5     | Ask a person         | Inbox **permission** item; step `waiting`; node `autoReject` timer |

Answers map to ACP option ids (`allow-once`, `allow-always`,
`reject-once` on Cursor). `allow_always` is stored per workflow in
settings, never globally.

## Flows MCP gateway

Agents never get connector credentials. `packages/mcp-gateway` is one
stdio MCP server per step (`mcpServers`/`mcp.json`) exposing the node's
allowed capabilities as tools. Each call goes to the engine over a private
socket, through the permission chain and `ConnectorRuntime` (secrets from
`SecretStore`). One audit choke point: every call is a run event.

Server (BL-165): `--tools` + `--socket`; `tools/call` → `gateway/call`
(ndjson) with `FLOWS_GATEWAY_TOKEN`. No secrets or connector code.

Engine (BL-166): `createMcpGatewayBridge` opens one token-auth socket per
step, appends `connector_called`; profiles use `launchSpec` for mcp.json
(BL-167).

## Inbox

A projection, not a store: items come from run events
(`approval_requested`, `permission_requested`, `question_asked`,
`plan_review_requested`) and connector events (`sign_in_expired`). An
item resolves when its answer event is appended. `inbox/answer` is a
command routed to the owning run actor, so the answer and the run's
next step are in one ordered log.

## Docket, Library, Connectors, Skills

- **Docket**: DES-038 as specified; `DocketIndex` projection from
  `DocumentStore` + `FileWatcher`; writes hash-checked; moves rewrite one
  card (`rank`). Listens to `run.finished` to add a `flows-run` ref.
- **Library**: providers are data (`library-providers.ts` in the mockup);
  a pull is a job that calls `ConnectorRuntime` and writes an immutable
  `v<n>/` folder; `current` is newest unless pinned.
- **Connectors**: `connectors/<id>.yaml` holds transport, `how`, auth kind
  and capability switches; secrets only in `SecretStore`. A
  `ConnectorTransport` registry (`mcp`, `api`, `cli`) adapts each.
- **Skills**: `SkillCatalog` scans `.agents`, `.claude`, `.cursor` in
  workspace and home; install copies from a source (Library repo item)
  and records `from`; invalid `SKILL.md` is listed with `problem`.

## Plugins

```ts
interface EnginePlugin {
  id: string
  nodeKinds?: NodeKind<any>[]
  agentProfiles?: AgentProfile[]
  connectorTransports?: ConnectorTransport[]
  libraryProviders?: ProviderDescriptor[]
  policies?: PermissionRule[]
}
```

Registered statically at `createEngine`; no dynamic loading in v2 (YAGNI).
