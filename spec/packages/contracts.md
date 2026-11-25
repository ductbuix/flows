# `@workspace/contracts` — shared schemas, ids and FCP definitions

Path: `packages/contracts`. Leaf package: depends only on `zod` and `yaml`;
must not import any other `@workspace/*` package (lint-enforced). Browser-safe:
no `node:*` imports in non-test sources (hashing etc. is done by callers).
Declared as a dependency by core, adapters-node, agent-acp, sdk, and the
server, cli, desktop and web apps.

This spec is split:

| File                                     | Covers                                                                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [contracts.md](contracts.md)             | package files, tooling, file tree, root exports, tests                                                                                                                                             |
| [contracts-core.md](contracts-core.md)   | every top-level `src/*.ts`: ids, workflow/app config, lifecycle, publish, connectors, library, providers, model/effort, run inputs, trust, notices, MCP trust, engine events, runs view/WS schemas |
| [contracts-nodes.md](contracts-nodes.md) | `src/nodes` (node workflow schema, kinds, ports, answers, judge, loops, parse, YAML edits) and `src/docket` (card/board schemas, tolerant parse, YAML edits)                                       |
| [contracts-fcp.md](contracts-fcp.md)     | `src/fcp`: method/notification definitions, error codes, method tables                                                                                                                             |

## package.json

```json
{
  "name": "@workspace/contracts",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test": "vitest run"
  },
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "yaml": "^2.9.1", "zod": "^4.6.7" },
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

No build step: the single export points at the `.ts` source; consumers
compile it. Internal imports always use explicit `.ts` extensions.

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

(`types: ["node"]` is for the tests; sources stay Node-free.)

## eslint.config.js

Flat config via `defineConfig` from `eslint/config`:

1. `globalIgnores(["dist"])`.
2. `**/*.ts`: extends `js.configs.recommended` + `tseslint.configs.recommended`,
   `languageOptions.globals = globals.node`.
3. `noCycleBlock` from root `eslint-dependency-guards.mjs` (`import/no-cycle`,
   `maxDepth: Infinity`, via `eslint-plugin-import-x` registered as `import`).
4. `**/*.{ts,tsx}`: `...contractsRestrictedImports` (rule
   `no-restricted-imports` with pattern group `["@workspace/*"]`, message
   `"contracts must not import other workspace packages"`) and
   `max-lines: ["warn", { max: 200, skipBlankLines: true, skipComments: true }]`.
5. Tests `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`: `max-lines` warn at 300.

`src/eslint-dependency-guards.d.ts` declares module
`"*eslint-dependency-guards.mjs"` exporting `noCycleBlock` (`{ files: string[];
plugins; settings; rules }`) and `contractsRestrictedImports`,
`coreRestrictedImports`, `adaptersRestrictedImports`, `webRestrictedImports`
(each `Record<string, unknown>`), so `dependency-lint.test.ts` can import the
root `.mjs`. See [tooling.md](../tooling.md#eslint).

Because of the no-cycle rule, imports between modules must stay acyclic:
`events.ts` → `nodes/index.ts`; `nodes/output.ts` → `fcp/notice.ts` →
`fcp/define.ts`; `trust.ts` → `docket/schemas.ts`; `nodes/loops.ts` and
`nodes/parse.ts` and `nodes/yaml-edit.ts` import from `nodes/index.ts`
(type-only for loops/yaml-edit).

## File tree

```
src/
  index.ts                 package root barrel (see below)
  ids.ts                   slug schemas + 7 branded ids
  task-ids.ts              isSafeTaskId, upstreamEnvName
  health.ts                healthSchema
  workflow.ts              agentJudge, retry, timeout, limits, input decls, workflow name, app config
  lifecycle.ts             workflow create/rename bodies, memory files, workflow-relative file paths
  publish.ts               publish policy, refresh rule, sign-in method, task uses, change sets
  connector.ts             connector file schema (connectors/<id>.yaml), AUTH_FOR, summary, YAML io
  connector-describe.ts    built-in connector adapter descriptions, check result
  library.ts               legacy connection library: pins, resources.json, entities, usage
  lib-item.ts              Library item item.yaml + versions, tags, YAML io
  provider.ts              Library provider descriptors, DEFAULT_PROVIDERS, detect()
  model-effort.ts          effort enum, model catalogs, resolveModelEffort
  run-inputs.ts            inputs.json, canonical item-key payloads, input value schema/defaults
  cursor-question.ts       Cursor ask_question question/answer schemas
  cursor-plan.ts           Cursor create_plan todo/phase schemas
  trust.ts                 run start body, trust/preflight, input errors, CLI status
  notices.ts               in-app notices
  mcp-trust.ts             MCP server allow list
  events.ts                engine event log schemas (32 event types), task/run status
  runs.ts                  barrel of the six runs-*.ts files
  runs-summary.ts          workflow summary, run summary, needs-you entries
  runs-detail.ts           run detail, task view, run step, canvas, pins, effects
  runs-artifacts.ts        log chunks, summary, out file list
  runs-requests.ts         start response, request id, ok, api error
  runs-workflow.ts         YAML diagnostics, workflow detail/save/conflict
  runs-ws.ts               legacy websocket client/server messages
  eslint-dependency-guards.d.ts   typing for the root eslint guards module
  nodes/                   node workflow model   → contracts-nodes.md
  docket/                  docket cards & board  → contracts-nodes.md
  fcp/                     FCP definitions       → contracts-fcp.md
  *.test.ts                vitest (see Tests)
```

## src/index.ts

Exact re-export surface of `@workspace/contracts`:

1. `export *` from: `ids`, `publish`, `connector`, `connector-describe`,
   `library`, `lib-item`, `provider`, `health`, `workflow`, `model-effort`,
   `run-inputs`, `task-ids`, `cursor-question`, `cursor-plan`, `events`
   (in that order).
2. Named from `./runs.ts`: `workflowSummarySchema, needsYouEntrySchema,
runSummarySchema, taskViewSchema, runLibraryPinSchema, runEffectSchema,
runDetailSchema, logChunkSchema, summaryResponseSchema, outFileSchema,
outListSchema, startRunResponseSchema, requestIdBodySchema,
okResponseSchema, apiErrorSchema, yamlDiagnosticSchema,
putWorkflowBodySchema, workflowConflictSchema, wsClientMessageSchema,
wsServerMessageSchema, workflowDetailSchema, runStepSchema,
runCanvasSchema` and types `WorkflowSummary, NeedsYouEntry, RunSummary,
TaskView, RunLibraryPin, RunEffect, RunDetail, LogChunk, SummaryResponse,
OutList, StartRunResponse, RequestIdBody, OkResponse, ApiError,
YamlDiagnosticDto, RunStep, RunCanvas, WorkflowDetail, PutWorkflowBody,
WorkflowConflict, WsClientMessage, WsServerMessage`.
   Not exported from root: `logStreamSchema`.
3. `export *` from `trust`, `notices`, `mcp-trust`, `lifecycle`.
4. Named from `./nodes/index.ts`: `workflowSchema, nodeSchema, edgeSchema,
PORT_TABLE` and types `Workflow, WorkflowNode, WorkflowEdge`.
5. `export *` from `./nodes/yaml-edit.ts` and `./nodes/parse.ts`.
6. Named from `./nodes/index.ts`: `NODE_KINDS, DEFAULT_LOOP_PASSES,
proposeConnectionsUpstream, assetResourceSchema`, types `AssetResource,
NodeKindName`.
7. `export *` from `./nodes/answers.ts`.
8. Named from `./nodes/judge.ts`: `CHECK_OPERATORS, evaluateCheck,
judgeCheckSchema, judgeModeSchema`, types `CheckOperator, JudgeCheck`.
9. `export *` from `./nodes/layout.ts`, `./docket/index.ts`,
   `./nodes/loops.ts`, `./fcp/index.ts`.

Consequently NOT reachable from the root (internal only): `defineNodeKind`,
`nodeIdSchema`, `NodeKindDef`, `PortType`, `NodeGroup`, `EDGE_LIMIT`,
`NODE_LIMIT`, `nodeLimitsSchema`, `edgeProblems`, `portTypeSchema`,
`NodePorts`, `OLD_WORKFLOW_KEYS`, `judgeSettingProblems`,
`NUMBER_OPERATORS`, `UNARY_OPERATORS`, the `*Kind` definitions,
`stepSettings`, `stepAllowLists`, `runUpdateAgentKinds`,
`libraryAddRemoteParamsSchema`, `libraryAddLocalParamsSchema`.
Everything else documented in the sub-files is exported.

## Tests (vitest, `src/**/*.test.ts`)

| File                       | What it pins down                                                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.test.ts`            | `healthSchema` accepts `{ok:true,version}`; rejects `ok:false` and missing version                                                                                                                                                  |
| `ids.test.ts`              | all 7 brands accept slugs/UUIDs, reject `""`, `Bad`, `has_underscore`, `-lead`, `trail-`, `a--b`; brand types are distinct                                                                                                          |
| `task-ids.test.ts`         | `isSafeTaskId`, `upstreamEnvName`                                                                                                                                                                                                   |
| `lifecycle.test.ts`        | `isAllowedWorkflowFilePath` accept/reject cases                                                                                                                                                                                     |
| `model-effort.test.ts`     | `resolveModelEffort` precedence and per-field fallthrough                                                                                                                                                                           |
| `run-inputs.test.ts`       | canonical payload stability, trim text not markdown, required values, defaults                                                                                                                                                      |
| `connector.test.ts`        | `AUTH_FOR` pairs, capability defaults, `cmd` kept, strict secret-key rejection, invalid id, YAML parse                                                                                                                              |
| `provider.test.ts`         | pattern validation, default providers, `detect`/`tagsOf`                                                                                                                                                                            |
| `dependency-lint.test.ts`  | runs ESLint on scratch files with the root guard rule sets (contracts/core/adapters/web restricted imports, `import/no-cycle`)                                                                                                      |
| `nodes/nodes.test.ts`      | sample workflow parse (loopPasses default 5), port table one row per kind, strict typos, edge errors, duplicate ids, first old key named, judge branches, llm `planReview` `auto\|ask` only, llm needs cli and has no file out port |
| `nodes/answers.test.ts`    | parse/format answers, templates, ambiguity, approval question validation, bad declarations                                                                                                                                          |
| `nodes/yaml-edit.test.ts`  | comment-keeping add/remove/rename/set, duplicate edge no-op, missing target returns input, empty flow lists grow into block lists                                                                                                   |
| `docket/docket.test.ts`    | card passthrough, tolerant card/board parse warnings, board `face` default `[]` and max 2                                                                                                                                           |
| `docket/yaml-edit.test.ts` | patch keeps comments/unknown keys, card md round-trip                                                                                                                                                                               |
| `fcp/fcp.test.ts`          | method type inference, error code uniqueness, table membership and kinds                                                                                                                                                            |
