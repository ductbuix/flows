---
id: DES-042
title: Design patterns and coding standards for v2
type: design
status: draft
summary: Which patterns v2 uses and where, dependency rules and their lint guards, error, async, naming, testing and extension conventions.
tags: [standards, patterns, architecture, testing, lint, design]
related: [DES-039, DES-040, DES-041, DES-035, DES-014]
updated: 2026-11-24
---

# Design patterns and coding standards for v2

Principles from DES-014 still rule (local first, files are the context,
the event log is the truth, KISS and YAGNI). This doc says how they turn
into code in the v2 packages (DES-039).

## Patterns and where they live

| Pattern                           | Where                                              | Why                                             |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Hexagonal (ports and adapters)    | `core/ports`, `adapters-node`, `agent-acp`         | engine reusable in daemon, Electron, tests      |
| Facade                            | `Engine` from `createEngine`                       | one entry point per host                        |
| Composition root                  | `createEngine` + each host `main.ts`               | wiring in one place, no DI container            |
| Bounded contexts                  | `core/<context>/`                                  | each mockup area evolves alone                  |
| Event sourcing + fold             | runs (`EventStore`, `fold.ts`)                     | resume, audit, run view replay                  |
| Functional core, imperative shell | `runs/decide.ts` pure, `runs/actor.ts` does I/O    | rules tested without I/O                        |
| Actor (mailbox per run)           | `runs/actor.ts`                                    | one writer per run, no locks                    |
| Command / query split             | FCP `get_*`/`list*` vs commands with `requestKey`  | safe retries, idempotent commands               |
| Projection (read model)           | `DocketIndex`, `InboxProjection`, run summaries    | fast lists, rebuilt from truth                  |
| Optimistic concurrency            | `baseHash` on every document write                 | UI, agents and hand edits share files           |
| Strategy                          | `NodeKind`, `AgentProfile`, `ConnectorTransport`   | new behaviour = new module, not a new branch    |
| Registry                          | node kinds, profiles, transports, providers        | extend in one place (DES-035)                   |
| Chain of Responsibility           | permission policy                                  | ordered, testable safety rules                  |
| Adapter                           | ACP to `AgentEvent`, MCP gateway to connectors     | outside protocols stay at the edge              |
| Observer (typed bus)              | domain events between contexts, `UpdateBus` to FCP | contexts stay decoupled                         |
| Data-driven descriptors           | Library providers, board columns                   | add a system without a release                  |
| Tolerant reader                   | card files, FCP updates, unknown `kind`s           | hand edits and newer peers never break a reader |

Not used, on purpose: a DI container, class hierarchies for domain
objects, an ORM, a global store in the engine, dynamic plugin loading.

## Dependency rules (lint enforced)

| Rule                                                                 | Guard                                     |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `contracts` imports nothing in the repo                              | `no-restricted-imports`                   |
| `core` has no `node:*`, `fs`, `child_process`, `better-sqlite3`, DOM | `no-restricted-imports` in `core/**`      |
| A context imports another only via its `index.ts`                    | `import/no-internal-modules` per context  |
| Adapters import `core` ports, never another adapter                  | path rule                                 |
| UIs import `sdk`, `sdk-react`, `contracts`, `ui` only                | path rule; no `hc`, no `core`             |
| No cycles                                                            | `import/no-cycle` (or dependency-cruiser) |

## Code standards

### Types and data

- **zod at boundaries only**: FCP params and results, files read from
  disk, ACP messages. Inside core, use the inferred types.
- **Branded ids**: `CardId`, `RunId`, `WorkflowId`, `StepId`,
  `ConnectorId` (`z.string().brand()`); no bare `string` ids in
  signatures.
- **Discriminated unions** with a `kind` field for events, updates,
  effects and errors; `switch` with an exhaustive `never` check.
- Readonly inputs; services return new objects; no mutation of arguments.

### Errors

- Expected failures are values: `Result<T, EngineError>` inside core;
  services throw only `EngineError` (code from the DES-040 table), and the
  binding maps it to JSON-RPC. Anything else is `internal` and logged.
- Never swallow: a caught error is either converted, rethrown or logged
  with context. Messages are written for the user; detail goes to `data`.

### Async, cancellation, streams

- Every long call takes an `AbortSignal` and passes it down to ports.
- Streams are `AsyncIterable` (agent events, step events, log reads);
  backpressure comes from pulling.
- Time and ids come from `Clock` and `Ids`, never `Date.now()` or
  `crypto.randomUUID()` in core, so tests are deterministic.
- Timeouts are settings, not literals.

### Files and writes

- Writes are atomic (temp file + rename) and hash-checked.
- YAML edits keep comments, key order and unknown keys (existing helpers).
- Paths come from one `paths` module per context; no string-built paths
  elsewhere.

### Modules and naming

- Files `kebab-case.ts`, one main export, at most ~200 lines; split by
  responsibility, not by layer type.
- Factories `createX(deps): X` returning an interface; classes only when
  a lifecycle needs private state (actor, peer).
- FCP methods `namespace/verb_snake`; events `past_tense_snake`
  (`step_done`); effects `imperative_snake` (`launch_step`).
- Public exports of a package go through its `index.ts`; nothing deep
  imports `src/...` across packages.

## Testing

| Level         | What                                                         | Tool                   |
| ------------- | ------------------------------------------------------------ | ---------------------- |
| Pure unit     | `decide`, `fold`, rank, policy chain, mappers                | vitest, table-driven   |
| Port contract | one suite per port, run against the fake **and** the adapter | vitest `describe.each` |
| Service       | services on in-memory fakes via `createEngine(fakeDeps)`     | vitest                 |
| Protocol      | sdk to `bindEngine` over a linked transport pair             | vitest                 |
| Agent         | `agent-acp` against a scripted fake ACP agent (stdio)        | vitest                 |
| End to end    | daemon + web (and Electron smoke) with a fake agent profile  | Playwright             |

Rules: no real agent CLI or network in CI; a fake ACP agent replays a
recorded JSON-RPC script. Each bug fix adds the smallest test that fails
first. Golden FCP transcripts guard protocol compatibility.

## Extension recipes

| Add a...            | Steps                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Node kind           | settings schema + ports in `contracts`; executor in `core/nodes/kinds/`; card in `apps/web/src/nodes/`; register in three registries (DES-035) |
| ACP agent           | `AgentProfile` in `agent-acp/profiles/`; fake-agent test; no core change                                                                       |
| Connector transport | `ConnectorTransport` adapter; contract suite; register                                                                                         |
| Library provider    | descriptor (data) in settings or a plugin; no code if it fits the fields                                                                       |
| FCP method          | entry in `contracts` method table, service method, sdk gets it for free; bump the doc's method list                                            |
| UI host             | implement `Transport`; call `initialize` with its capabilities                                                                                 |

## Observability

- Structured logs with `runId`, `stepId`, `sessionId`, `requestId`.
- Every agent JSON-RPC message is written to the step's `acp.ndjson`
  (secrets redacted) so a run can be replayed in the fake agent.
- `engine/health` lists ports with status (SQLite open, watcher live,
  agent profiles found).

## Review checklist

- Does core still build without Node types (`tsc -p core --lib es2023`)?
- Does a new port have a fake and a contract suite?
- Is every new FCP field optional, or is the version bumped?
- Is the safety rule in the policy chain, not inside an executor?
- Can the feature be data (descriptor) instead of code?
