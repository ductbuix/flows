# `@workspace/contracts` — top-level modules

Part of the [contracts spec](contracts.md). Covers every `src/*.ts` file
(not `nodes/`, `docket/`, `fcp/`). All schemas are zod 4 (`import { z } from "zod"`).
Every exported schema `xSchema` has a matching `export type X = z.infer<typeof xSchema>`
unless noted. "slug" below always means regex
`/^[a-z0-9]+(?:-[a-z0-9]+)*$/` with message `"lowercase letters, digits and dashes"`.
`str1` = `z.string().min(1)`; `int+` = `z.number().int().positive()`;
`int0` = `z.number().int().nonnegative()`; `?` = `.optional()`.

## ids.ts

Private `slugRegex`, `slugMessage` (above).

| Export               | Definition                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `slugIdSchema`       | `z.string().min(1).regex(slug, msg)` (unbranded)                                           |
| `connectionIdSchema` | alias, same object as `slugIdSchema`                                                       |
| `CardId`             | `z.string().regex(slug,msg).brand<"CardId">()` (no `.min(1)`; regex already rejects empty) |
| `RunId`              | same, brand `"RunId"`                                                                      |
| `WorkflowId`         | same, brand `"WorkflowId"`                                                                 |
| `StepId`             | same, brand `"StepId"`                                                                     |
| `ConnectorId`        | same, brand `"ConnectorId"`                                                                |
| `SkillSlug`          | same, brand `"SkillSlug"`                                                                  |
| `LibItemId`          | same, brand `"LibItemId"`                                                                  |

Each brand is exported as both a value (schema) and a type of the same name
(`export type CardId = z.infer<typeof CardId>`). Tests: `"a"`, `"my-item"`,
a lowercase UUID valid; `""`, `"Bad"`, `"has_underscore"`, `"-lead"`,
`"trail-"`, `"a--b"` invalid; a `RunId` is not assignable to `CardId` (type test).

## task-ids.ts

- `isSafeTaskId(id: string): boolean` — false when empty, starts with `.`,
  or contains `/` or `\`; otherwise true (so legacy ids like `start` pass).
- `upstreamEnvName(taskId)` → `` `UPSTREAM_${taskId.replaceAll("-", "_")}` ``
  (case kept; `fix-bug` → `UPSTREAM_fix_bug`).

## health.ts

`healthSchema = { ok: z.literal(true), version: z.string() }` → `Health`.

## workflow.ts

| Export                      | Shape                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentJudgeSchema`          | `{ cli: enum["claude","cursor"], model: modelIdSchema?, effort: effortSchema? }` → `AgentJudge`                                                   |
| `retrySchema`               | `{ max: int+ .default(3) }` → type `RetryPolicy`                                                                                                  |
| `timeoutSecondsSchema`      | `int+` (no type export)                                                                                                                           |
| `workflowLimitsSchema`      | `{ concurrency: int+?, agents: int+?, maxConcurrentRuns: int+? }` → `WorkflowLimits` (maxConcurrentRuns omitted means 1)                          |
| `workflowInputDeclSchema`   | see below → `WorkflowInputDecl`; `WorkflowInputType = WorkflowInputDecl["type"]`                                                                  |
| `workflowNameSchema`        | `z.string().trim().min(1).max(80)`                                                                                                                |
| `DEFAULT_LIBRARY_MAX_BYTES` | `5 * 1024 * 1024 * 1024` (5 GiB)                                                                                                                  |
| `agentsConfigSchema`        | `{ runtime: enum["spawn","acp"].default("spawn") }` (no type)                                                                                     |
| `appConfigSchema`           | `{ limits: workflowLimitsSchema?, library: { maxBytes: int+? }?, agents: agentsConfigSchema? }` → `AppConfig` (shape of `~/.flowapp/config.yaml`) |

`workflowInputDeclSchema` = object `{ name, type: enum["text","markdown","file"],
required: boolean, description: string?, default: string? }` where `name` is
`z.string().min(1)` refined by `/^[A-Za-z][A-Za-z0-9_-]*$/` and not in
reserved set `{"inputs","attach"}`; refine message
`"input name must match ^[A-Za-z][A-Za-z0-9_-]*$ and not be reserved"`.
`superRefine`: if `default !== undefined && type === "file"` add custom issue
`"default is only allowed on text and markdown inputs"` at path `["default"]`.

## lifecycle.ts

| Export                           | Shape                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `workflowIdSchema`               | `str1.regex(slug, msg)` (unbranded)                                                       |
| `createWorkflowBodySchema`       | `{ id: workflowIdSchema, name: workflowNameSchema?, goal: str1 }` → `CreateWorkflowBody`  |
| `renameWorkflowBodySchema`       | `{ newId: workflowIdSchema }` → `RenameWorkflowBody`                                      |
| `renameWorkflowResponseSchema`   | `{ id: workflowIdSchema }` → `RenameWorkflowResponse`                                     |
| `memoryFileNameSchema`           | `str1.regex(/^[a-zA-Z0-9._-]+\.md$/, "memory file must be a .md basename")`               |
| `memoryFileSummarySchema`        | `{ name: memoryFileNameSchema, hash: str1, referencedBy: str1[] }` → `MemoryFileSummary`  |
| `memoryListSchema`               | `{ files: memoryFileSummarySchema[] }` → `MemoryList`                                     |
| `memoryFileDetailSchema`         | `{ name, content: string, hash: str1, referencedBy: str1[] }` → `MemoryFileDetail`        |
| `putMemoryBodySchema`            | `{ content: string, baseHash: str1? }` → `PutMemoryBody`                                  |
| `renameMemoryBodySchema`         | `{ newName: memoryFileNameSchema, updateReferences: boolean? }` → `RenameMemoryBody`      |
| `memoryConflictSchema`           | `{ message: literal "conflict", diskContent: string, diskHash: str1 }` → `MemoryConflict` |
| `isAllowedWorkflowFilePath(rel)` | function, see below                                                                       |
| `workflowFilePathSchema`         | `str1.refine(isAllowedWorkflowFilePath, "invalid workflow-relative path")`                |
| `workflowFileDetailSchema`       | `{ path: str1, content: string, hash: str1 }` → `WorkflowFileDetail`                      |
| `putWorkflowFileBodySchema`      | `{ content: string, baseHash: str1? }` → `PutWorkflowFileBody`                            |
| `workflowFileConflictSchema`     | same object as `memoryConflictSchema`; `type WorkflowFileConflict = MemoryConflict`       |

`isAllowedWorkflowFilePath(rel)` returns false when: empty; starts with `/`;
contains `\`; any `/`-segment is empty, `.` or `..`; equals `workflow.yaml`;
first segment is `runs` or `.cache`; first two segments are `nodes`, `.trash`.
Otherwise true.

## publish.ts

| Export                     | Shape                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `publishPolicySchema`      | enum `"read-only" \| "approve-each-publish" \| "trust-agent-review"` → `PublishPolicy`              |
| `refreshRuleSchema`        | enum `"15m" \| "1h" \| "1d" \| "never"` → `RefreshRule`                                             |
| `signInMethodSchema`       | enum `"cli" \| "mcp" \| "cookies"` → `SignInMethod`                                                 |
| `connectionAccessSchema`   | enum `"read" \| "propose"` → `ConnectionAccess`                                                     |
| `taskUsesEntrySchema`      | `{ connection: slugIdSchema, access: connectionAccessSchema }` → `TaskUsesEntry`                    |
| `taskUsesSchema`           | `z.array(taskUsesEntrySchema)`                                                                      |
| `connectionEnvName(id)`    | `` `RESOURCE_${id.replaceAll("-", "_").toUpperCase()}` ``                                           |
| `changeSetOpSchema`        | `{ op: str1, target: str1, summary: str1, destructive: boolean, payload: unknown }` → `ChangeSetOp` |
| `changeSetSchema`          | `{ v: literal 1, connection: slugIdSchema, base: str1, ops: changeSetOpSchema[] }` → `ChangeSet`    |
| `runChangesResponseSchema` | `{ changeSet: changeSetSchema, previewMd: string }` → `RunChangesResponse`                          |

## connector.ts (connector files `connectors/<id>.yaml`)

| Export                           | Shape                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connectorFileIdSchema`          | = `connectionIdSchema`                                                                                                                                                                                                      |
| `connectorTransportSchema`       | enum `"mcp" \| "api" \| "cli"` → `ConnectorTransport`                                                                                                                                                                       |
| `connectorAuthSchema`            | enum `"cookies" \| "pat" \| "oauth" \| "cli-login" \| "none"` → `ConnectorAuth`                                                                                                                                             |
| `connectorStatusSchema`          | enum `"connected" \| "expired" \| "off"` → `ConnectorStatus`                                                                                                                                                                |
| `AUTH_FOR`                       | `{ mcp: ["oauth","pat","none"], api: ["cookies","pat","oauth"], cli: ["cli-login","pat"] }` `as const satisfies Record<ConnectorTransport, readonly ConnectorAuth[]>`                                                       |
| `capabilitySchema`               | see below → `Capability`                                                                                                                                                                                                    |
| `connectorSchema`                | see below → `ConnectorFile`; `ConnectorFileInput = z.input<connectorFieldsSchema>`                                                                                                                                          |
| `connectorSummarySchema`         | `{ id, name: str1, transport, how: str1, auth, providerId: str1?, status: connectorStatusSchema.default("off"), checkedAt: str1? }` → `ConnectorSummary`                                                                    |
| `toConnectorSummary(c, status?)` | copies id/name/transport/how/auth, `providerId` only when defined, `status: status?.status ?? "off"`, `checkedAt` only when `status?.checkedAt` defined. `status` arg type `{ status: ConnectorStatus; checkedAt: string }` |
| `parseConnectorYaml(text)`       | `connectorSchema.parse(parseYaml(text) ?? {})` (throws)                                                                                                                                                                     |
| `safeParseConnectorYaml(text)`   | YAML parse in try; on YAML throw returns `connectorSchema.safeParse({ __yamlError: err.message \| "invalid YAML" })` (fails as unknown key on strict object)                                                                |
| `connectorToYaml(c)`             | `stringify(c, { lineWidth: 0 })` from `yaml`                                                                                                                                                                                |

`capabilitySchema` = object `{ name: str1, desc: string.default(""),
write: boolean.default(false), allowed: boolean?, cmd: str1[]? }` then
`.transform` to `{ name, desc, write, allowed: allowed ?? !write, cmd? }`
(`cmd` key present only when given). So reads default allowed, writes default
not allowed.

`connectorFieldsSchema` (private) = `z.strictObject({ id: connectorFileIdSchema,
name: str1, transport, how: str1, auth, capabilities: capabilitySchema[].default([]),
providerId: str1? })`. Strict: unknown keys (e.g. `token`, `password`,
`cookie`) fail. `connectorSchema = connectorFieldsSchema.superRefine`: when
`auth` not in `AUTH_FOR[transport]`, issue code `"custom"`, path `["auth"]`,
message `` `auth "${auth}" is not allowed for transport "${transport}"` ``.

## connector-describe.ts

| Export                        | Shape                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `connectorDescribeSchema`     | `{ id: str1, entityKinds: str1[], scopeFields: str1[], signInMethods: signInMethodSchema[].min(1) }` → `ConnectorDescribe` |
| `connectorsListSchema`        | `{ connectors: connectorDescribeSchema[] }` → `ConnectorsList`                                                             |
| `connectionCheckResultSchema` | `{ ok: boolean, message: str1, ambientLogin: str1? }` → `ConnectionCheckResult`                                            |

## library.ts (legacy connection library, DES-026)

| Export                     | Shape                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resourcePinSchema`        | `{ connection: connectionIdSchema, kind: str1, entityId: str1, revision: str1, title: str1 }` → `ResourcePin`                                                          |
| `resourcesJsonSchema`      | `{ v: literal 1, pins: resourcePin[], warnings: str1[].default([]) }` → `ResourcesJson` (file `resources.json`)                                                        |
| `resourcesIndexSchema`     | `{ v: literal 1, entries: resourcePin[] }` → `ResourcesIndex`                                                                                                          |
| `libraryPullBodySchema`    | `{ connection, kind: str1?, entityId: str1? }` → `LibraryPullBody`                                                                                                     |
| `libraryRevisionSchema`    | `{ revision: str1, pulledAt: str1, title: str1, current: boolean, pinningRunIds: str1[] }` → `LibraryRevision`                                                         |
| `libraryEntitySchema`      | `{ connection, kind: str1, entityId: str1, title: str1, refresh: refreshRuleSchema, pulledAt: str1?, fresh: boolean, revisions: libraryRevision[] }` → `LibraryEntity` |
| `libraryUsageSchema`       | `{ usedBytes: int0, maxBytes: int+ }` → `LibraryUsage`                                                                                                                 |
| `LIBRARY_USAGE_WARN_RATIO` | `0.8`                                                                                                                                                                  |
| `libraryListSchema`        | `{ entities: libraryEntity[], usage: libraryUsage }` → `LibraryList`                                                                                                   |
| `libraryPullResultSchema`  | `{ connection, kind, entityId, revision, title, pulledAt }` (all str1 / connection id) → `LibraryPullResult`                                                           |
| `libraryClearBodySchema`   | `{ connection, kind: str1, entityId: str1 }` → `LibraryClearBody`                                                                                                      |
| `libraryClearResultSchema` | `{ connection, kind, entityId, removed: str1[] }` → `LibraryClearResult`                                                                                               |

## lib-item.ts (Library items, DES-039/041)

| Export                                                         | Shape                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libVersionSchema`                                             | `{ n: int+, at: str1, note: string, contentHash: str1 }` → `LibVersion`                                                                                                                                                                             |
| `libTagSchema`                                                 | `z.string().regex(/^[^:\s]+:.+$/, "tag must be namespace:value")` → `LibTag`                                                                                                                                                                        |
| `libItemDiskSchema`                                            | `{ id: LibItemId, kind: providerIconSchema, title: str1, source: str1, remoteId: str1?, remoteUrl: str1?, tags: libTag[].default([]), current: int+ }` → `LibItemDisk` (on-disk `item.yaml`; `source` = provider id, `"local"` means never fetched) |
| `libItemSchema`                                                | `libItemDiskSchema.extend({ versions: libVersion[] })` → `LibItem` (versions newest first)                                                                                                                                                          |
| `parseLibItemYaml(text)`                                       | `libItemDiskSchema.parse(parseYaml(text) ?? {})`                                                                                                                                                                                                    |
| `safeParseLibItemYaml(text)`                                   | as connector: YAML error → safeParse of `{ __yamlError }` (non-strict object, so fails on missing fields)                                                                                                                                           |
| `libItemToYaml(item)`                                          | `stringify(item, { lineWidth: 0 })`                                                                                                                                                                                                                 |
| `libVersionMetaSchema`                                         | identical fields to `libVersionSchema` (separate object) → `LibVersionMeta` (file `v<n>/meta.yaml` contents)                                                                                                                                        |
| `parseLibVersionMetaYaml(text)` / `libVersionMetaToYaml(meta)` | parse / stringify with `lineWidth: 0`                                                                                                                                                                                                               |

## provider.ts (Library providers)

| Export                                                           | Shape                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `providerIdSchema`                                               | = `connectionIdSchema`                                                                                                                                                                                                                    |
| `providerIconSchema`                                             | enum `"repo","confluence","rally","ci","logs","web","image","html","other"` → `ProviderIcon`                                                                                                                                              |
| `providerAccessSchema`                                           | enum `"read","readwrite"` → `ProviderAccess`                                                                                                                                                                                              |
| `assertProviderPattern(pattern)`                                 | `new RegExp(pattern, "i")`; on throw → `Error("invalid regex")`; if `compiled.source` lacks `(?<id>` → `Error("pattern needs named group id")`                                                                                            |
| `providerPatternSchema`                                          | `str1.superRefine` calling `assertProviderPattern`; issue `"custom"` with the error message (fallback `"invalid pattern"`)                                                                                                                |
| `providerDescriptorSchema`                                       | `z.strictObject({ id: providerIdSchema, label: str1, icon, pattern: providerPatternSchema, example: string, layout: str1[].min(1), tags: str1[], access, fetch: str1, custom: boolean? })` → `ProviderDescriptor`                         |
| `DEFAULT_PROVIDERS`                                              | `readonly ProviderDescriptor[]`, three entries below                                                                                                                                                                                      |
| `ProviderMatch`                                                  | type `{ provider, id: string, url: string, title: string }`                                                                                                                                                                               |
| `tagsOf(m)`                                                      | `m.provider.tags` with every `{id}` replaced by `m.id`                                                                                                                                                                                    |
| `detect(url, providers)`                                         | trims url; empty → `null`; first provider whose `new RegExp(pattern,"i").exec(u)?.groups?.id` is truthy → `{ provider, id, url: trimmed, title: `${label} ${id}` }`; regex construction errors are swallowed (never match); none → `null` |
| `parseProviderYaml` / `safeParseProviderYaml` / `providerToYaml` | same pattern as connector (`lineWidth: 0`)                                                                                                                                                                                                |

`DEFAULT_PROVIDERS` (exact values):

| id           | label      | icon       | pattern (JS string)                             | example                                  | layout                                                          | tags                           | access    | fetch                                                                  |
| ------------ | ---------- | ---------- | ----------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- | ------------------------------ | --------- | ---------------------------------------------------------------------- |
| `github`     | GitHub     | repo       | `github\.com/(?<id>[^/]+/[^/?#]+)`              | `https://github.com/ductbuix/flows`      | `repo/README.md`, `repo/package.json`, `repo/src/index.ts`      | `repo:{id}`, `type:repository` | readwrite | `git clone --depth 1 to fetch, git push to write back`                 |
| `confluence` | Confluence | confluence | `confluence[^/]*/.*pages/(?<id>\d+)`            | `https://confluence.example/pages/48213` | `page.md`, `export.html`, `attachments/image-1.png`             | `confluence:{id}`, `type:page` | readwrite | `Confluence MCP: page as Markdown to fetch, page update to write back` |
| `rally`      | Rally      | rally      | `rally[^/]*/.*?(?<id>(?:US\|DE\|F\|EP\|TA)\d+)` | `https://rally.example/slm/US1234`       | `ticket.json`, `description.md`, `attachments/attachment-1.png` | `rally:{id}`                   | read      | `Rally web services API: artifact JSON and attachments`                |

None set `custom`; each parses unchanged through `providerDescriptorSchema`.
Tests: `detect("https://github.com/ductbuix/flows")` → id `ductbuix/flows`,
title `GitHub ductbuix/flows`, `tagsOf` → `["repo:ductbuix/flows","type:repository"]`;
confluence URL → `48213`; rally → `US1234`; `https://example.com/x` → null.

## model-effort.ts

| Export                      | Shape                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `effortSchema`              | enum `"low","medium","high","xhigh","max"` → `Effort`                                                                                                              |
| `EFFORTS`                   | `readonly Effort[]` same order                                                                                                                                     |
| `modelIdSchema`             | `str1`                                                                                                                                                             |
| `agentCliDefaultsSchema`    | `{ model: modelId?, effort: effort? }` → `AgentCliDefaults`                                                                                                        |
| `workflowAgentSchema`       | `{ claude: agentCliDefaults?, cursor: agentCliDefaults? }` → `WorkflowAgent`                                                                                       |
| `cliModelEntrySchema`       | `{ id: str1, label: str1, efforts: effort[] }` → `CliModelEntry`                                                                                                   |
| `cliModelCatalogSchema`     | `{ cli: enum["claude","cursor"], defaultLabel: str1, defaults: { model: string?, effort: effort? }, models: cliModelEntry[], error: string? }` → `CliModelCatalog` |
| `ModelSource`               | type `"task" \| "workflow" \| "cli"`                                                                                                                               |
| `AgentSpec`                 | type `{ cli: "claude"\|"cursor"; model?: string; effort?: Effort; memory?: string[] }`                                                                             |
| `ResolvedModelEffort`       | type `{ model?: string; effort?: Effort; modelSource: ModelSource }`                                                                                               |
| `resolveModelEffort(input)` | see below                                                                                                                                                          |

`resolveModelEffort({ judge?: {model?,effort?}, task?: {cli, model?, effort?},
workflowAgent?, judgeCli? })`:

1. `cli = judgeCli ?? task?.cli`; workflow defaults = `workflowAgent[cli]` for
   claude/cursor, else none.
2. Task values apply only when "same-cli": `task` present and (`judgeCli`
   unset or `task.cli === judgeCli`).
3. Each of model and effort independently: judge value (source `task`) →
   same-cli task value (source `task`) → workflow default (source
   `workflow`) → none.
4. `modelSource` = `task` if any field came from task/judge, else `workflow`
   if any from workflow, else `cli`.
5. Result omits `model` / `effort` keys when undefined.

## run-inputs.ts

| Export                               | Shape / behavior                                                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ManualItemKeyField`                 | type `{ name; type: "text"\|"markdown"; text: string } \| { name; type: "file"; sha256: string }`                                                                                                                                                                        |
| `inputsJsonSchema`                   | `{ source: literal "manual", itemKey: str1, itemKeyVersion: literal 1, fields: record<string, field>, cardId: str1? }` → `InputsJson`; field = union `{ type: enum["text","markdown"], value: string }` \| `{ type: literal "file", path: str1 }` (frozen `inputs.json`) |
| `canonicalCardKeyPayload(cardId)`    | `JSON.stringify({ v: 1, source: "card", cardId })` (key order exactly v, source, cardId)                                                                                                                                                                                 |
| `runInputFileDetailSchema`           | `{ path: str1, content: string }` → `RunInputFileDetail`                                                                                                                                                                                                                 |
| `normalizeInputText(type, value)`    | `value.normalize("NFC")`, then `.trim()` only for `text` (markdown keeps whitespace)                                                                                                                                                                                     |
| `canonicalManualItemPayload(fields)` | copy sorted by `name.localeCompare`; `JSON.stringify({ v: 1, source: "manual", fields: sorted })`                                                                                                                                                                        |
| `buildManualValuesSchema(decls)`     | `z.object(shape).passthrough()` where for every non-file decl: required → `z.string().refine(v => v.trim().length > 0, "required")`, else `z.string().optional()`                                                                                                        |
| `applyInputDefaults(decls, values)`  | copy defined values; for each non-file decl missing in output with a `default`, set it. Returns `Record<string,string>`                                                                                                                                                  |

Hashing (SHA-256) is done by callers in Node; this module stays browser-safe.

## cursor-question.ts / cursor-plan.ts

| Export                       | Shape                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `cursorAskOptionSchema`      | `{ id: str1, label: str1 }` → `CursorAskOption`                                                       |
| `cursorAskQuestionSchema`    | `{ id: str1, prompt: str1, options: option[].min(1), allowMultiple: boolean? }` → `CursorAskQuestion` |
| `cursorAskAnswerSchema`      | `{ questionId: str1, selectedOptionIds: str1[].min(1) }` → `CursorAskAnswer`                          |
| `cursorPlanTodoStatusSchema` | enum `"pending","in_progress","completed","cancelled"` → `CursorPlanTodoStatus`                       |
| `cursorPlanTodoSchema`       | `{ id: str1, content: str1, status }` → `CursorPlanTodo`                                              |
| `cursorPlanPhaseSchema`      | `{ name: str1, todos: todo[] }` → `CursorPlanPhase`                                                   |

## trust.ts

| Export                      | Shape                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `trustGrantSchema`          | enum `"once","always"` → `TrustGrant`                                                                                                                                                                              |
| `cliTrustValueSchema`       | `{ homeRealpath: str1, trustedAt: str1 }` → `CliTrustValue`                                                                                                                                                        |
| `trustDecisionSchema`       | enum `"once","always","none"` → `TrustDecision`                                                                                                                                                                    |
| `startRunBodySchema`        | `{ requestId: str1, trustGrant?, values: record<string,string>?, confirmDuplicate: boolean?, refreshPins: boolean?, cardId: cardIdSchema? (docket), only: str1?, from: str1?, baseRunId: str1? }` → `StartRunBody` |
| `invalidInputErrorSchema`   | `{ error: literal "invalid_input", fields: record<string,string> }` → `InvalidInputError`                                                                                                                          |
| `duplicateInputErrorSchema` | `{ error: literal "duplicate_input", itemKey: str1, existingRunIds: str1[].min(1) }` → `DuplicateInputError`                                                                                                       |
| `unknownCardErrorSchema`    | `{ error: literal "unknown_card", cardId: str1 }` → `UnknownCardError`                                                                                                                                             |
| `trustCheckStatusSchema`    | enum `"pass","warn"` → `TrustCheckStatus`                                                                                                                                                                          |
| `trustCheckSchema`          | `{ id: str1, status, message: str1 }` → `TrustCheck`                                                                                                                                                               |
| `trustStatusSchema`         | `{ trust: trustDecision, homeRealpath: str1, alwaysTrusted: boolean }` → `TrustStatus`                                                                                                                             |
| `putTrustBodySchema`        | `{ grant: enum["always","none"] }` → `PutTrustBody`                                                                                                                                                                |
| `preflightResponseSchema`   | `{ trust: trustDecision, checks: trustCheck[], needsAgentCli: boolean, clis: enum["claude","cursor"][].default([]) }` → `PreflightResponse`                                                                        |
| `trustRequiredErrorSchema`  | `{ error: literal "trust_required", message: str1, trust: literal "none", checks: trustCheck[] }` → `TrustRequiredError`                                                                                           |
| `cliInfoSchema`             | `{ id: enum["claude","cursor"], installed: boolean, version: string.nullable() }` → `CliInfo`                                                                                                                      |
| `cliStatusSchema`           | `{ clis: cliInfo[] }` → `CliStatus`                                                                                                                                                                                |

## notices.ts

| Export                      | Shape                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `noticeSchema`              | `{ id: int+, title: string, text: string, runId: string, workflowId: string, nodeId: string, at: string, read: boolean }` → `Notice` |
| `noticeListSchema`          | `{ notices: notice[], unread: int0 }` → `NoticeList`                                                                                 |
| `markNoticesReadBodySchema` | `{ ids: int+[].max(500)? }` → `MarkNoticesReadBody` (omitted = mark all)                                                             |

## mcp-trust.ts

| Export                  | Shape                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| `mcpTrustEntrySchema`   | `{ key: str1, trustedAt: str1 }` → `McpTrustEntry`                       |
| `mcpTrustValueSchema`   | `{ servers: entry[] }` → `McpTrustValue`                                 |
| `mcpTrustStatusSchema`  | `{ servers: entry[] }` → `McpTrustStatus`                                |
| `putMcpTrustBodySchema` | `{ key: str1, grant: enum["once","always","none"] }` → `PutMcpTrustBody` |

## events.ts (engine event log)

Status enums:

- `taskStatusSchema`: `"pending","awaiting_approval","running","succeeded","failed","skipped","cancelled"` → `TaskStatus`.
- `runStatusSchema`: `"queued","running","succeeded","failed","cancelled"` → `RunStatus`.

Every event has `type` (literal) plus base `{ runId: str1, at: str1 }`.
"step base" = base + `{ nodeId: str1, pass: int+ }` (both required).
"attempt keys" = `{ taskId: str1, nodeId: str1?, pass: int+?, attempt: int+ }`.

| `type`                  | Schema export                    | Extra fields                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run_started`           | `runStartedEventSchema`          | `workflowId: str1`, `graph: workflowSchema` (frozen node graph), `trigger: str1?`, `only: str1?`, `from: str1?`, `trustGrant: literal "once"?`, `source: literal "manual"?`, `itemKey: str1?`, `inputHash: str1?`, `files: string[]?`, `queued: boolean?`, `cardId: str1?` |
| `run_activated`         | `runActivatedEventSchema`        | none (queued run got a slot)                                                                                                                                                                                                                                               |
| `attempt_started`       | `attemptStartedEventSchema`      | attempt keys                                                                                                                                                                                                                                                               |
| `attempt_launched`      | `attemptLaunchedEventSchema`     | attempt keys + `pid: int+`, `sandboxed: boolean?`, `timeout: int+?` (seconds), `model: str1?`, `effort: effortSchema?`, `modelSource: enum["task","workflow","cli"]?`                                                                                                      |
| `attempt_finished`      | `attemptFinishedEventSchema`     | attempt keys + `exitCode: z.number().int()`, `reason: str1?`                                                                                                                                                                                                               |
| `attempt_interrupted`   | `attemptInterruptedEventSchema`  | attempt keys                                                                                                                                                                                                                                                               |
| `approval_requested`    | `approvalRequestedEventSchema`   | `taskId: str1`, `nodeId: str1?`, `pass: int+?`, `question: string?`                                                                                                                                                                                                        |
| `permission_requested`  | `permissionRequestedEventSchema` | `nodeId: str1`, `pass: int+`, `tool: str1`, `requestId: str1`, `question: string?`                                                                                                                                                                                         |
| `permission_answered`   | `permissionAnsweredEventSchema`  | `nodeId`, `pass`, `requestId: str1`, `optionId: enum["allow-once","allow-always","reject-once"]`                                                                                                                                                                           |
| `question_asked`        | `questionAskedEventSchema`       | `nodeId`, `pass`, `requestId: str1` (ACP toolCallId), `title: str1?`, `questions: cursorAskQuestion[].min(1)`                                                                                                                                                              |
| `question_answered`     | `questionAnsweredEventSchema`    | `nodeId`, `pass`, `requestId`, `outcome: enum["answered","skipped"]`, `answers: cursorAskAnswer[]?`, `reason: str1?`                                                                                                                                                       |
| `plan_review_requested` | `planReviewRequestedEventSchema` | `nodeId`, `pass`, `requestId`, `name: str1?`, `overview: str1?`, `plan: str1`, `todos: cursorPlanTodo[]`                                                                                                                                                                   |
| `plan_review_answered`  | `planReviewAnsweredEventSchema`  | `nodeId`, `pass`, `requestId`, `outcome: enum["accepted","rejected"]`, `reason: str1?`                                                                                                                                                                                     |
| `cancel_requested`      | `cancelRequestedEventSchema`     | none                                                                                                                                                                                                                                                                       |
| `run_cancelled`         | `runCancelledEventSchema`        | `reason: literal "rejected"?`                                                                                                                                                                                                                                              |
| `run_succeeded`         | `runSucceededEventSchema`        | none                                                                                                                                                                                                                                                                       |
| `run_failed`            | `runFailedEventSchema`           | none                                                                                                                                                                                                                                                                       |
| `run_deleted`           | `runDeletedEventSchema`          | none (marker; fold hides run)                                                                                                                                                                                                                                              |
| `library_pulled`        | `libraryPulledEventSchema`       | `connection: connectionId`, `kind: str1`, `entityId: str1`, `revision: str1`, `impact: literal "read"`                                                                                                                                                                     |
| `work_copy_changed`     | `workCopyChangedEventSchema`     | `connection`, `impact: literal "local"`, `opCount: int0`, `destructive: boolean`                                                                                                                                                                                           |
| `publish_started`       | `publishStartedEventSchema`      | `taskId: str1`, `connection`                                                                                                                                                                                                                                               |
| `publish_finished`      | `publishFinishedEventSchema`     | `taskId`, `connection`, `status: enum["applied","conflict","rejected"]`, `message: str1?`, `result: record<string,unknown>?`, `undoNote: str1?`, `impact: literal "cloud"?`                                                                                                |
| `agent_review_finished` | `agentReviewFinishedEventSchema` | `taskId`, `connection`, `verdict: enum["approve","escalate"]`, `reason: str1`                                                                                                                                                                                              |
| `step_started`          | `stepStartedEventSchema`         | step base                                                                                                                                                                                                                                                                  |
| `step_done`             | `stepDoneEventSchema`            | step base + `outputs: str1[]?`, `branch: str1?`, `answer: record<string,unknown>?`, `reused: literal true?`                                                                                                                                                                |
| `step_failed`           | `stepFailedEventSchema`          | step base + `reason: enum["exit","timeout","unclear","answer","loop_limit","conflict","rejected"]` (required)                                                                                                                                                              |
| `step_skipped`          | `stepSkippedEventSchema`         | step base + `reused: literal true?`                                                                                                                                                                                                                                        |
| `step_approved`         | `stepApprovedEventSchema`        | step base                                                                                                                                                                                                                                                                  |
| `step_rejected`         | `stepRejectedEventSchema`        | step base                                                                                                                                                                                                                                                                  |
| `step_retry_requested`  | `stepRetryRequestedEventSchema`  | step base                                                                                                                                                                                                                                                                  |
| `step_cancelled`        | `stepCancelledEventSchema`       | step base                                                                                                                                                                                                                                                                  |
| `connector_called`      | `connectorCalledEventSchema`     | step base + `connectorId: str1`, `capability: str1`, `status: enum["ok","denied","error"]`, `message: str1?`                                                                                                                                                               |

`engineEventSchema = z.discriminatedUnion("type", [...])` with all 32
schemas in exactly the table order. Type exports: `EngineEvent`,
`RunStartedEvent`, `RunActivatedEvent` only (others are not exported as types).
Note `events.ts` imports `workflowSchema` from `./nodes/index.ts`.

## runs-*.ts (re-exported by `runs.ts`)

`runs.ts` is `export * from` each of the six files below. The root index
re-exports only a named subset (see [contracts.md](contracts.md#srcindexts));
`logStreamSchema` is not exported from the package root.

### runs-summary.ts

| Export                  | Shape                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflowSummarySchema` | `{ id: str1, name: str1?, goal: string?, taskCount: int0 }` → `WorkflowSummary`                                                                                                                                                                           |
| `needsYouEntrySchema`   | `{ taskId: str1, connectionId: str1?, question: string? }` → `NeedsYouEntry`                                                                                                                                                                              |
| `runSummarySchema`      | `{ id: str1, workflowId: str1, workflowName: str1, status: runStatus, needsYou: needsYouEntry[], taskCounts: { done: int0, total: int0 }, firstFailedTaskId: str1?, itemKey: str1?, cardId: str1?, startedAt: str1, finishedAt: string? }` → `RunSummary` |

### runs-detail.ts

| Export                | Shape                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskViewSchema`      | `{ id: str1, status: taskStatus, attempts: Array<{ attempt: int+, pid: int+?, exitCode: int?, interrupted: boolean?, reason: str1?, model: str1?, effort: effort?, modelSource: enum["task","workflow","cli"]? }> }` → `TaskView`                                                                                                                                                                  |
| `runLibraryPinSchema` | `{ connection: connectionId, kind: str1, entityId: str1, revision: str1, title: str1, fresh: boolean, usedByTaskIds: str1[] }` → `RunLibraryPin`                                                                                                                                                                                                                                                   |
| `runEffectSchema`     | `{ what: str1, connection: connectionId, impact: enum["read","local","cloud"], result: str1?, undoNote: str1? }` → `RunEffect`                                                                                                                                                                                                                                                                     |
| `runStepSchema`       | `{ nodeId: str1, kind: str1, pass: int+, attempts: int0, status: taskStatus, branch: str1?, failReason: str1?, question: string?, decision: enum["approved","rejected"]?, answer: record<string,unknown>?, reused: literal true?, startedAt: string?, endedAt: string? }` → `RunStep`                                                                                                              |
| `runCanvasSchema`     | `{ workflow: workflowSchema, layout: layoutFileSchema, texts: record<string,string> }` → `RunCanvas` (texts keyed like `nodes/plan/prompt.md`)                                                                                                                                                                                                                                                     |
| `runDetailSchema`     | `{ id: str1, workflowId: str1, status: runStatus, cardId: str1?, startedAt: str1, finishedAt: string?, sandboxed: boolean, lastSeq: int0, graph: workflowSchema, tasks: taskView[], steps: runStep[]?, taskCounts: { total: int0, finished: int0, awaitingApproval: int0 }, inputFiles: string[].default([]), pins: runLibraryPin[].default([]), effects: runEffect[].default([]) }` → `RunDetail` |

### runs-artifacts.ts

| Export                  | Shape                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `logStreamSchema`       | enum `"stdout","stderr","events"` (`events` = NDJSON activity log)                               |
| `logChunkSchema`        | `{ stream: logStream, offset: int0, nextOffset: int0, text: string, eof: boolean }` → `LogChunk` |
| `summaryResponseSchema` | `{ text: string.nullable(), missing: boolean }` → `SummaryResponse`                              |
| `outFileSchema`         | `{ path: str1, type: enum["file","dir"] }` (no type)                                             |
| `outListSchema`         | `{ files: outFile[] }` → `OutList`                                                               |

### runs-requests.ts

| Export                   | Shape                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| `startRunResponseSchema` | `{ runId: str1, status: enum["queued","running"] }` → `StartRunResponse` |
| `requestIdBodySchema`    | `{ requestId: str1 }` → `RequestIdBody`                                  |
| `okResponseSchema`       | `{ ok: literal true }` → `OkResponse`                                    |
| `apiErrorSchema`         | `{ error: str1, message: str1 }` → `ApiError`                            |

### runs-workflow.ts

| Export                   | Shape                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yamlDiagnosticSchema`   | `{ message: str1, path: (string\|number)[], from: int0, to: int0, severity: literal "error" }` → type `YamlDiagnosticDto`                                                               |
| `workflowDetailSchema`   | `{ id: str1, yaml: string, hash: str1, workflow: workflowSchema.nullable(), errors: yamlDiagnostic[], layout: layoutFileSchema.default({ version: 1, nodes: {} }) }` → `WorkflowDetail` |
| `putWorkflowBodySchema`  | `{ yaml: string, baseHash: str1, renames: Array<{ from: str1, to: str1 }>? }` → `PutWorkflowBody`                                                                                       |
| `workflowConflictSchema` | `{ message: literal "conflict", diskYaml: string, diskHash: str1 }` → `WorkflowConflict`                                                                                                |

### runs-ws.ts (legacy WS message shapes, still exported)

`wsClientMessageSchema` = discriminatedUnion on `type` → `WsClientMessage`:

| type                   | fields                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `subscribe_run`        | `runId: str1`, `afterSeq: int0?`                                                             |
| `unsubscribe_run`      | `runId: str1`                                                                                |
| `subscribe_log`        | `runId`, `taskId: str1`, `attempt: int+`, `stream: enum["stdout","stderr"]`, `offset: int0?` |
| `unsubscribe_log`      | `runId`, `taskId`, `attempt`, `stream`                                                       |
| `subscribe_workflow`   | `workflowId: str1`                                                                           |
| `unsubscribe_workflow` | `workflowId: str1`                                                                           |

`wsServerMessageSchema` → `WsServerMessage`:

| type           | fields                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| `hello`        | none                                                                    |
| `engine_event` | `seq: int+`, `event: engineEventSchema`                                 |
| `run_snapshot` | `run: runDetailSchema`                                                  |
| `log_chunk`    | `runId: str1`, `taskId: str1`, `attempt: int+`, `chunk: logChunkSchema` |
| `file_changed` | `workflowId: str1`, `path: str1`, `hash: str1`, `content: string`       |
| `runs_changed` | `runId: str1`, `summary: runSummarySchema.nullable()` (null = deleted)  |
| `error`        | `message: str1`                                                         |
