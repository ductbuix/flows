# `@workspace/contracts` — FCP method definitions (`src/fcp`)

Part of the [contracts spec](contracts.md). FCP (Flows Control Protocol,
DES-040) is JSON-RPC 2.0 over `@workspace/protocol`'s `RpcPeer`. This folder
only declares names and zod schemas; engine/client behavior lives in core,
server and sdk. Notation as in [contracts-core.md](contracts-core.md).

Common conventions in every file:

- `requestKey` = private `fcpRequestKeySchema = z.string().uuid().optional()`
  (idempotency key on commands; redeclared per file, never exported).
- List limits: `limit: z.number().int().positive().max(500).optional()`
  (constant `DEFAULT_LIST_LIMIT_MAX` / `DEFAULT_LIMIT_MAX = 500`, private).
- Paged results are `{ items: T[], next?: cursor }`.
- Every notification payload has `seq: int0` and a `kind` literal; all
  notification params are `z.discriminatedUnion("kind", …)`.
- Each method is exported as `<ns><Name>Method` (e.g. `runStartMethod`)
  together with `<ns><Name>ParamsSchema` / `<ns><Name>ResultSchema` unless
  noted (some methods inline params).

## Files

```
fcp/
  define.ts           MethodKind, FcpMethodDef, FcpNotificationDef, defineMethod/Notification, infer helpers
  errors.ts           ErrorCode map, jsonRpcCodeFor
  version.ts          FCP_VERSION
  initialize.ts       initialize handshake
  ping.ts             ping
  subscribe.ts        subscribe / unsubscribe, RUN_LIGHT_KINDS
  docket.ts           docket/* board + card methods, docket/update
  docket-assets.ts    docket/add_asset, docket/remove_asset
  connector.ts        connector/* methods, connector/update
  library.ts          library/* methods, library/update
  workflow.ts         workflow/* methods, workflow/update
  run.ts              run/* methods, run/update
  run-update-kinds.ts agent-stream kinds spliced into run/update
  skill.ts            skill/* methods, skill/update
  file.ts             file/* methods
  inbox.ts            inbox item schemas, inbox/* methods, inbox/update
  notice.ts           noticeChannelSchema, notice/update
  settings.ts         settings/* methods
  host.ts             engine→client host/* methods, fcpHostMethodTable
  table.ts            fcpMethodTable, fcpNotificationTable
  index.ts            barrel
  fcp.test.ts         type inference + table membership tests
```

`index.ts` is `export *` of every file except `run-update-kinds.ts` (not
re-exported) and `library.ts`, which is re-exported by an explicit list that
omits `libraryAddRemoteParamsSchema` and `libraryAddLocalParamsSchema`
(everything else in library.ts is listed).

## define.ts

```ts
export type MethodKind = "query" | "command"
export type FcpMethodDef<
  Name extends string = string,
  Params extends z.ZodType = z.ZodType,
  Result extends z.ZodType = z.ZodType,
  Kind extends MethodKind = MethodKind,
> = {
  readonly name: Name
  readonly params: Params
  readonly result: Result
  readonly kind: Kind
}
export type FcpNotificationDef<
  Name extends string = string,
  Params extends z.ZodType = z.ZodType,
> = { readonly name: Name; readonly params: Params }
export function defineMethod(def): def // identity, for inference
export function defineNotification(def): def // identity
export type FcpMethodParams<M> = z.infer<M["params"]>
export type FcpMethodResult<M> = z.infer<M["result"]>
export type FcpNotificationParams<N> = z.infer<N["params"]>
```

`query` = read-only (sdk may cache/dedupe), `command` = mutation.

## errors.ts

`ErrorCode` (const object; `type ErrorCode = keyof typeof ErrorCode`). The
key is the stable `error.data.code` string; the value is the JSON-RPC
`error.code`. All values unique.

| key              | JSON-RPC code |
| ---------------- | ------------- |
| `invalid_params` | -32602        |
| `not_found`      | -32004        |
| `conflict`       | -32009        |
| `busy`           | -32010        |
| `policy_denied`  | -32011        |
| `needs_trust`    | -32012        |
| `unsupported`    | -32013        |
| `cancelled`      | -32800        |
| `internal`       | -32603        |

`jsonRpcCodeFor(code: ErrorCode): number` → `ErrorCode[code]`.
(Error `data` payload shapes such as conflict bodies are defined by the
schemas noted per method below, e.g. `docketConflictCardSchema`,
`workflowConflictCurrentSchema`.)

## version.ts

`FCP_VERSION = 1 as const` — integer protocol version; bump when the method
table changes.

## initialize.ts — `initialize` (query)

| Export                     | Shape                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fcpClientInfoSchema`      | `{ name: str1, version: str1 }`                                                                                                                                                           |
| `clientCapabilitiesSchema` | passthrough object `{ host?: passthrough { revealPath: boolean?, browserSignIn: boolean?, notifications: boolean? }, updates?: passthrough { coalesced: boolean? } }` with `.default({})` |
| `agentInfoSchema`          | `{ id: string, name: string?, version: string? }`                                                                                                                                         |
| `engineCapabilitiesSchema` | `{ agents: agentInfo[], nodeKinds: string[], transports: { connector: string[] }?, blobs: { http: string }? }`                                                                            |
| `fcpWorkspaceSchema`       | `{ home: string, id: string }`                                                                                                                                                            |
| `initializeParamsSchema`   | `{ protocolVersion: int0, clientInfo, clientCapabilities }`                                                                                                                               |
| `initializeResultSchema`   | `{ protocolVersion: int+, engineInfo: fcpClientInfoSchema, engineCapabilities, workspace }`                                                                                               |
| `initializeMethod`         | name `"initialize"`, kind `query`                                                                                                                                                         |

## ping.ts — `ping` (query)

`pingParamsSchema = z.object({})`, `pingResultSchema = { ok: literal true }`, `pingMethod`.

## subscribe.ts

- `fcpTopicSchema = str1` — a namespace topic (`docket`, `run`, …) or a
  scoped topic (`run:r-1`).
- `subscribe` (command): params `subscribeParamsSchema = { topics: topic[].min(1),
since: int0? }`; result `subscribeResultSchema = { seq: int0, resync: topic[] }`.
- `unsubscribe` (command): params `{ topics: topic[].min(1) }`; result `{}`.
- Exports `subscribeMethod`, `unsubscribeMethod`, `unsubscribeParamsSchema`,
  `unsubscribeResultSchema`.
- `RUN_LIGHT_KINDS = ["run_changed", "step_state"] as const` — subscribers of
  the bare `run` topic receive only these `run/update` kinds; scoped
  `run:<id>` subscribers get all kinds.

## Method table (`table.ts`)

`fcpMethodTable` (`as const satisfies Record<string, FcpMethodDef>`) has
69 entries; keys equal each method's `name`, in this exact order
(q = query, c = command):

1. `initialize` q, `ping` q, `subscribe` c, `unsubscribe` c
2. `docket/get_board` q, `docket/list_cards` q, `docket/get_card` q,
   `docket/create_card` c, `docket/update_card` c, `docket/move_card` c,
   `docket/delete_card` c, `docket/add_asset` c, `docket/remove_asset` c,
   `docket/save_board` c
3. `connector/list` q, `connector/get` q, `connector/save` c,
   `connector/remove` c, `connector/set_capability` c
4. `library/list` q, `library/get` q, `library/pull` c, `library/push` c,
   `library/add` c, `library/unlink` c, `library/pin_version` c,
   `library/set_tags` c, `library/remove` c
5. `connector/check` c, `connector/sign_in` c, `connector/sign_out` c
6. `library/list_providers` q, `library/save_provider` c
7. `workflow/list` q, `workflow/get` q, `workflow/create` c,
   `workflow/save` c, `workflow/rename` c, `workflow/delete` c,
   `workflow/save_layout` c, `workflow/validate` q
8. `run/list` q, `run/get` q, `run/start` c, `run/cancel` c, `run/rerun` c,
   `run/retry_step` c, `run/delete` c, `run/get_log` q, `run/get_changes` q
9. `skill/list` q, `skill/get` q, `skill/list_sources` q, `skill/install` c,
   `skill/uninstall` c, `skill/save` c
10. `file/list` q, `file/stat` q, `file/read_text` q, `file/write_text` c,
    `file/reveal` c
11. `inbox/list` q, `inbox/answer` c, `inbox/dismiss` c
12. `settings/cli_status` q, `settings/get_trust` q, `settings/set_trust` c,
    `settings/list_mcp_trust` q, `settings/set_mcp_trust` c

`fcpNotificationTable` (`as const satisfies Record<string, FcpNotificationDef>`):
`docket/update`, `workflow/update`, `run/update`, `skill/update`,
`inbox/update`, `notice/update`, `library/update`, `connector/update`.

`fcpHostMethodTable` (in host.ts, NOT part of `fcpMethodTable`; engine calls
client): `host/reveal_path`, `host/browser_sign_in`.

## docket.ts

Exports (besides methods): `cursorPageParamsSchema`, `cardBacklinkSchema`,
`indexedAssetSchema`, `indexedLinkSchema`, `cardFaceSchema` (type
`WireCardFace`), `docketGetBoardResultSchema`, `docketListCardsResultSchema`,
`docketGetCardResultSchema`, `docketCardPatchSchema`, create/update/delete/
save-board/move params+result schemas, `docketConflictCardSchema` (=
`docketGetCardResultSchema`), `docketConflictBoardSchema` (=
`docketGetBoardResultSchema`), `docketUpdateNotification`.

| Schema                      | Shape                                                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cursorPageParamsSchema`    | `{ cursor: cardIdSchema?, limit: int+.max(500)? }`                                                                                                                                                                                                                          |
| `cardBacklinkSchema`        | `{ from: cardId, rel: cardLinkRel }`                                                                                                                                                                                                                                        |
| `indexedAssetSchema`        | `assetSchema.extend({ scope: assetScope (required), missing: boolean }).passthrough()`                                                                                                                                                                                      |
| `indexedLinkSchema`         | `cardLinkSchema.extend({ dangling: boolean }).passthrough()`                                                                                                                                                                                                                |
| `cardFaceSchema`            | `{ id: cardId, path: str1, hash: string, title: string, status: string, columnId: string, rank: string, start: string?, due: string?, done: (string\|null)?, refs: ref[], linkCount: int0, assetCount: int0, missingLinkedAssetCount: int0, warnings: string[] }` (no body) |
| `docketGetCardResultSchema` | `cardFace.extend({ body: string, fields: record<string,unknown>?, assets: indexedAsset[], links: indexedLink[], backlinks: cardBacklink[] })`                                                                                                                               |
| `docketCardPatchSchema`     | `.strict()` object, all optional: `title: str1`, `status: string`, `body: string`, `rank: string`, `start/due/done: string \| null`, `refs: ref[]`, `assets: asset[]`, `links: cardLink[]`, `fields: record<string,unknown>`                                                |

| Method                   | Params                                                                                  | Result                                                                |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `docket/get_board` (q)   | `z.object({})` (inline)                                                                 | `{ board: boardSchema.nullable(), hash: string, warnings: string[] }` |
| `docket/list_cards` (q)  | `cursorPageParamsSchema`                                                                | `{ items: cardFace[], next: cardId? }`                                |
| `docket/get_card` (q)    | `{ id: cardId }` (inline)                                                               | `docketGetCardResultSchema`                                           |
| `docket/create_card` (c) | `{ id: cardId, title: str1, status: string?, body: string?, refs: ref[]?, requestKey }` | `{ hash: string, rank: string }`                                      |
| `docket/update_card` (c) | `{ id, baseHash: string, patch: docketCardPatchSchema, requestKey }`                    | `{ hash: string }`                                                    |
| `docket/move_card` (c)   | `{ id, status: str1, beforeId: (cardId \| null)?, baseHash: string, requestKey }`       | `{ hash: string, rank: string }`                                      |
| `docket/delete_card` (c) | `{ id, requestKey }`                                                                    | `{}`                                                                  |
| `docket/save_board` (c)  | `{ baseHash: string, board: boardSchema, migrateStatus: string?, requestKey }`          | `{ hash: string, migratedCardIds: cardId[]? }`                        |

`migrateStatus`: cards in removed columns get this status.

`docket/update` kinds:

| kind            | fields                               |
| --------------- | ------------------------------------ |
| `card_changed`  | `card: cardFaceSchema`               |
| `card_removed`  | `cardId: cardId`                     |
| `board_changed` | `hash: string`, `board: boardSchema` |

## docket-assets.ts

| Export                             | Shape                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docketAddOwnedAssetParamsSchema`  | `{ id: cardId, scope: literal "owned", blobId: str1, name: str1 (basename under card `assets/`), label: string?, baseHash: string, requestKey }` |
| `docketAddLinkedAssetParamsSchema` | `{ id, scope: literal "linked", path: str1 (absolute; never copied), label?, baseHash, requestKey }`                                             |
| `docketAddAssetParamsSchema`       | discriminatedUnion on `scope` of the two                                                                                                         |
| `docketAddAssetResultSchema`       | `{ hash: string, asset: indexedAssetSchema }`                                                                                                    |
| `docketAddAssetMethod`             | `docket/add_asset`, command                                                                                                                      |
| `docketRemoveAssetParamsSchema`    | `{ id, path: str1 (asset entry; file stays on disk), baseHash: string, requestKey }`                                                             |
| `docketRemoveAssetResultSchema`    | `{ hash: string }`                                                                                                                               |
| `docketRemoveAssetMethod`          | `docket/remove_asset`, command                                                                                                                   |

## connector.ts

| Method                         | Params                                                               | Result                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `connector/list` (q)           | `{ cursor: connectorFileId?, limit? }`                               | `{ items: connectorSummary[], next: connectorFileId? }`                                                                 |
| `connector/get` (q)            | `{ id: connectorFileId }`                                            | `{ connector: connectorSchema, hash: string, status: connectorStatus.default("off"), checkedAt: str1?, detail: str1? }` |
| `connector/save` (c)           | `{ connector: connectorSchema, baseHash: string?, requestKey }`      | `{ hash: string }`                                                                                                      |
| `connector/remove` (c)         | `{ id, requestKey }`                                                 | `{}`                                                                                                                    |
| `connector/set_capability` (c) | `{ id, name: str1, allowed: boolean, baseHash: string, requestKey }` | `{ hash: string }`                                                                                                      |
| `connector/check` (c)          | `{ id, requestKey }`                                                 | `{ status: connectorStatus, detail: str1? }`                                                                            |
| `connector/sign_in` (c)        | `{ id, requestKey }`                                                 | union `{ signedIn: literal true }` \| `{ cancelled: literal true }` (cookies stay in SecretStore)                       |
| `connector/sign_out` (c)       | `{ id, requestKey }`                                                 | `{ status: literal "off" }`                                                                                             |

Schema names: `connector{List,Get,Save,Remove,SetCapability,Check,SignIn,SignOut}{Params,Result}Schema` and `…Method`.

`connector/update` kinds: `status_changed` — `connectorId: connectorFileId`,
`status: connectorStatus`, `detail: str1?`, `checkedAt: str1`.

## library.ts

| Method                       | Params                                                                                                                                                                                                                                                                                   | Result                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `library/list_providers` (q) | `{ cursor: providerId?, limit? }`                                                                                                                                                                                                                                                        | `{ items: providerDescriptor[], next: providerId? }` |
| `library/save_provider` (c)  | `{ provider: providerDescriptorSchema, requestKey }`                                                                                                                                                                                                                                     | `{}`                                                 |
| `library/list` (q)           | `{ cursor: LibItemId?, limit?, tag: libTagSchema? }` (exact tag match filter)                                                                                                                                                                                                            | `{ items: libItem[], next: LibItemId? }`             |
| `library/get` (q)            | `{ id: LibItemId }`                                                                                                                                                                                                                                                                      | `libItemSchema`                                      |
| `library/pull` (c)           | `{ id, requestKey }`                                                                                                                                                                                                                                                                     | `libraryPullJobResultSchema = { jobId: str1 }`       |
| `library/push` (c)           | `{ id, requestKey }`                                                                                                                                                                                                                                                                     | `libraryPushResultSchema` (= pull job result)        |
| `library/add` (c)            | discriminatedUnion on `kind`: remote `{ kind: "remote", url: str1, requestKey }` \| local `{ kind: "local", title: str1, itemKind: providerIcon.default("other"), tags: libTag[].default([]), files: record<string,string>.default({}) (relative path → UTF-8 text of v1), requestKey }` | `libItemSchema`                                      |
| `library/unlink` (c)         | `{ id, requestKey }`                                                                                                                                                                                                                                                                     | `libItemSchema`                                      |
| `library/pin_version` (c)    | `{ id, n: int+, requestKey }`                                                                                                                                                                                                                                                            | `libItemSchema`                                      |
| `library/set_tags` (c)       | `{ id, tags: libTag[], requestKey }`                                                                                                                                                                                                                                                     | `libItemSchema`                                      |
| `library/remove` (c)         | `{ id, requestKey }`                                                                                                                                                                                                                                                                     | `{}`                                                 |

Note: there is no `libraryPullResultSchema` here — that name belongs to the
legacy top-level `library.ts`; FCP pull uses `libraryPullJobResultSchema`.

`library/update` kinds:

| kind           | fields                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `item_changed` | `item: libItemSchema`                                                                                                    |
| `item_removed` | `id: LibItemId`                                                                                                          |
| `job_progress` | `jobId: str1`, `itemId: LibItemId`, `message: string?`, `fraction: number.min(0).max(1)?`                                |
| `job_finished` | `jobId: str1`, `itemId: LibItemId`, `ok: boolean`, `unchanged: boolean?`, `version: libVersionSchema?`, `error: string?` |

## workflow.ts

| Method                     | Params                                                                                       | Result                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `workflow/list` (q)        | `{ cursor: str1?, limit? }`                                                                  | `{ items: workflowSummary[], next: str1? }`                         |
| `workflow/get` (q)         | `{ id: str1 }`                                                                               | `workflowDetailSchema`                                              |
| `workflow/create` (c)      | `{ id: workflowIdSchema (slug), goal: str1, name: workflowNameSchema?, requestKey }`         | `workflowSummarySchema`                                             |
| `workflow/save` (c)        | `{ id: str1, yaml: string, baseHash: str1, renames: {from: str1, to: str1}[]?, requestKey }` | `workflowDetailSchema`                                              |
| `workflow/rename` (c)      | `{ id: str1, newId: workflowIdSchema, requestKey }`                                          | `{ id: workflowIdSchema }`                                          |
| `workflow/delete` (c)      | `{ id: str1, requestKey }`                                                                   | `{}`                                                                |
| `workflow/save_layout` (c) | `{ id: str1, layout: layoutFileSchema, requestKey }`                                         | `layoutFileSchema`                                                  |
| `workflow/validate` (q)    | `{ yaml: string }`                                                                           | `{ workflow: workflowSchema.nullable(), errors: yamlDiagnostic[] }` |

Also exported: `workflowConflictCurrentSchema = { yaml: string, hash: str1 }`
(the `conflict` error data for `workflow/save`).

`workflow/update` kinds:

| kind               | fields                                               |
| ------------------ | ---------------------------------------------------- |
| `workflow_changed` | `workflowId: str1`, `summary: workflowSummarySchema` |
| `workflow_removed` | `workflowId: str1`                                   |
| `layout_changed`   | `workflowId: str1`, `layout: layoutFileSchema`       |

## run.ts

| Method                | Params                                                                                                                                                                                | Result                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `run/list` (q)        | `{ cursor: str1?, limit?, cardId: cardIdSchema?, workflowId: str1? }`                                                                                                                 | `{ items: runSummary[], next: str1? }`                                  |
| `run/get` (q)         | `{ id: str1 }`                                                                                                                                                                        | `runSummarySchema.extend({ steps: runStep[]? })` (latest step per node) |
| `run/start` (c)       | `{ workflowId: str1, requestKey, values: record<string,string>?, cardId: cardId?, refreshPins: boolean?, only: str1?, from: str1?, baseRunId: str1?, trustGrant: trustGrantSchema? }` | `{ runId: str1 }`                                                       |
| `run/cancel` (c)      | `{ runId: str1, requestKey }`                                                                                                                                                         | `{}`                                                                    |
| `run/rerun` (c)       | `{ runId: str1, requestKey, values?, refreshPins?, only?, from?, baseRunId? }`                                                                                                        | `{ runId: str1 }`                                                       |
| `run/retry_step` (c)  | `{ runId: str1, stepId: str1, requestKey }`                                                                                                                                           | `{}`                                                                    |
| `run/delete` (c)      | `{ runId: str1, requestKey }`                                                                                                                                                         | `{}`                                                                    |
| `run/get_log` (q)     | `{ runId: str1, stepId: str1, attempt: int+, pass: int+? (latest when omitted), stream: logStreamSchema ("stdout"\|"stderr"\|"events"), offset: int0? }`                              | `logChunkSchema`                                                        |
| `run/get_changes` (q) | `{ runId: str1, connectionId: connectionIdSchema }`                                                                                                                                   | `runChangesResponseSchema` (`{ changeSet, previewMd }`)                 |

`run/update` (`runUpdateNotification`) kinds, in union order. All carry
`seq: int0` and `runId: str1`; agent kinds carry `stepId: str1`:

| kind                  | fields                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `run_changed`         | `summary: runSummarySchema.nullable()` (null = deleted)                                              |
| `step_state`          | `step: runStepSchema`                                                                                |
| `agent_message_chunk` | `stepId`, `text: string`                                                                             |
| `agent_thought_chunk` | `stepId`, `text: string`                                                                             |
| `tool_call`           | `stepId`, `id: str1`, `title: string`, `toolKind: string`, `status: string`                          |
| `tool_call_update`    | `stepId`, `id: str1`, `status: string`, `content: unknown?`                                          |
| `plan`                | `stepId`, `entries: { content: string, status: string?, priority: string? }[]`                       |
| `todos`               | `stepId`, `entries: cursorPlanTodoSchema[]`                                                          |
| `subagent`            | `stepId`, `id: str1`, `description: str1`, `subagentType: str1`, `durationMs: number.nonnegative()?` |
| `usage`               | `stepId`, `used: number`, `size: number`, `cost: { amount: number, currency: string }?`              |
| `log_chunk`           | `stepId: str1?` (optional here), `chunk: logChunkSchema`                                             |
| `run_finished`        | `status: runStatusSchema`, `summary: runSummarySchema.nullable()`                                    |

The nine agent kinds (`agent_message_chunk` … `log_chunk`) live in
`run-update-kinds.ts` as `runUpdateAgentKinds` (a readonly tuple of zod
objects) and are spread between `step_state` and `run_finished`.

## skill.ts

| Export                   | Shape                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `skillScopeSchema`       | enum `"workspace","home"`                                                                                                                     |
| `skillDirSchema`         | enum `".agents",".claude",".cursor"`                                                                                                          |
| `skillFromSchema`        | `{ sourceId: str1, version: int+ }`                                                                                                           |
| `skillSummarySchema`     | `{ slug: SkillSlug, name: str1, description: string, scope, dirs: skillDir[].min(1), from: skillFrom?, problem: str1? }` → `WireSkillSummary` |
| `skillDetailSchema`      | summary `.extend({ body: string })` → `WireSkillDetail`                                                                                       |
| `skillSourceOfferSchema` | `{ slug: SkillSlug, name: str1, description: string, body: string }` → `WireSkillSourceOffer`                                                 |
| `skillSourceSchema`      | `{ id: str1, skills: offer[] }` → `WireSkillSource`                                                                                           |

| Method                   | Params                                                              | Result                                   |
| ------------------------ | ------------------------------------------------------------------- | ---------------------------------------- |
| `skill/list` (q)         | `{ cursor: str1?, limit? }`                                         | `{ items: skillSummary[], next: str1? }` |
| `skill/get` (q)          | `{ slug: SkillSlug, scope: skillScope }`                            | `skillDetailSchema`                      |
| `skill/list_sources` (q) | `{}`                                                                | `{ items: skillSource[] }`               |
| `skill/install` (c)      | `{ sourceId: str1, slug: SkillSlug, version: int+, requestKey }`    | `{ skill: skillDetailSchema }`           |
| `skill/uninstall` (c)    | `{ slug: SkillSlug, requestKey }`                                   | `{}`                                     |
| `skill/save` (c)         | `{ sources: str1[] (Library item ids; replaces list), requestKey }` | `{ sources: str1[] }`                    |

`skill/update` kinds: `skills_changed` (no other fields).

## file.ts

| Export            | Shape                    |
| ----------------- | ------------------------ |
| `fileKindSchema`  | enum `"file","dir"`      |
| `fileEntrySchema` | `{ path: string, kind }` |

| Method                | Params                                                                                 | Result                                               |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `file/list` (q)       | `{ path: string? (store-relative dir prefix; omit/"" = root), cursor: str1?, limit? }` | `{ items: fileEntry[], next: str1? }`                |
| `file/stat` (q)       | `{ path: str1 }`                                                                       | `{ path: string, kind, hash: string?, size: int0? }` |
| `file/read_text` (q)  | `{ path: str1 }`                                                                       | `{ path: string, text: string, hash: string }`       |
| `file/write_text` (c) | `{ path: str1, text: string, baseHash: string?, requestKey }`                          | `{ path: string, hash: string }`                     |
| `file/reveal` (c)     | `{ path: str1 }`                                                                       | `{}`                                                 |

## inbox.ts

Option id enums:

| Export                          | Values                                                         |
| ------------------------------- | -------------------------------------------------------------- |
| `inboxApprovalOptionIdSchema`   | `approved`, `rejected`                                         |
| `inboxPermissionOptionIdSchema` | `allow-once`, `allow-always`, `reject-once`                    |
| `inboxQuestionOptionIdSchema`   | `answered`, `skipped`                                          |
| `inboxPlanReviewOptionIdSchema` | `accepted`, `rejected`                                         |
| `inboxItemOptionIdSchema`       | union of the four                                              |
| `inboxItemKindSchema`           | `approval`, `permission`, `question`, `plan_review`, `sign_in` |

Run-item base: `{ id: str1, runId: str1, workflowId: str1?, nodeId: str1,
pass: int+, question: string, at: str1, status: enum["open","resolved"] }`.

| Schema                      | kind          | Extra fields                                                                                                                                  |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `inboxApprovalItemSchema`   | `approval`    | base + `decision: approvalOption?`                                                                                                            |
| `inboxPermissionItemSchema` | `permission`  | base + `tool: str1`, `requestId: str1`, `decision: permissionOption?`                                                                         |
| `inboxQuestionItemSchema`   | `question`    | base + `requestId: str1`, `title: str1?`, `questions: cursorAskQuestion[].min(1)`, `decision: questionOption?`, `answers: cursorAskAnswer[]?` |
| `inboxPlanReviewItemSchema` | `plan_review` | base + `requestId: str1`, `name: str1?`, `overview: str1?`, `plan: str1`, `todos: cursorPlanTodo[]`, `decision: planReviewOption?`            |
| `inboxSignInItemSchema`     | `sign_in`     | NOT run-based: `{ id: str1, connectorId: connectorFileId, question: string, at: str1, status: enum["open","resolved"] }`                      |

`inboxItemSchema` = discriminatedUnion on `kind` of the five → type `WireInboxItem`.

| Method              | Params                                                                                                                                                                                     | Result                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `inbox/list` (q)    | `{ cursor: str1?, limit? }`                                                                                                                                                                | `{ items: inboxItem[], next: str1? }` |
| `inbox/answer` (c)  | `{ itemId: str1, optionId: str1 (free string; engine validates against kind), answers: cursorAskAnswer[]? (required by engine when optionId is answered on a question item), requestKey }` | `{}`                                  |
| `inbox/dismiss` (c) | `{ itemId: str1, requestKey }`                                                                                                                                                             | `{}`                                  |

`inbox/update` kinds: `item_added` — `item: inboxItemSchema`;
`item_resolved` — `itemId: str1`, `decision: inboxItemOptionId?`.

## notice.ts

- `noticeChannelSchema = z.enum(["app","system"])` → `NoticeChannel`.
- `noticeUpdateNotification` (`notice/update`): params is a plain
  `z.object` (not a union) `{ seq: int0, kind: literal "notice_added",
notice: { title: string, text: string, runId: string, workflowId: string,
nodeId: string, channel: noticeChannel } }`. A desktop host shows
  `channel: system` ones as OS notifications.

## settings.ts

| Method                        | Params                                                               | Result                 |
| ----------------------------- | -------------------------------------------------------------------- | ---------------------- |
| `settings/cli_status` (q)     | `{}`                                                                 | `cliStatusSchema`      |
| `settings/get_trust` (q)      | `{}`                                                                 | `trustStatusSchema`    |
| `settings/set_trust` (c)      | `putTrustBodySchema` (`{ grant: "always"\|"none" }`)                 | `trustStatusSchema`    |
| `settings/list_mcp_trust` (q) | `{}`                                                                 | `mcpTrustStatusSchema` |
| `settings/set_mcp_trust` (c)  | `putMcpTrustBodySchema` (`{ key, grant: "once"\|"always"\|"none" }`) | `mcpTrustStatusSchema` |

Exports `settings{CliStatus,GetTrust,SetTrust,ListMcpTrust,SetMcpTrust}{ParamsSchema,ResultSchema,Method}` (the param/result schemas alias the trust ones).

## host.ts (engine → client)

| Export                                        | Shape                                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hostStoredCookieSchema`                      | `{ name: str1, value: string, domain: str1?, path: str1.default("/"), expires: number?, httpOnly: boolean?, secure: boolean?, sameSite: enum["Strict","Lax","None"]? }` → `HostStoredCookie` |
| `hostRevealPathParamsSchema` / `ResultSchema` | `{ path: str1 }` / `{}`                                                                                                                                                                      |
| `hostRevealPathMethod`                        | `host/reveal_path`, command                                                                                                                                                                  |
| `hostBrowserSignInParamsSchema`               | `{ connectorId: connectorFileId, url: z.string().url(), cookieDomains: str1[].min(1) }`                                                                                                      |
| `hostBrowserSignInResultSchema`               | union `{ cookies: hostStoredCookie[] }` \| `{ cancelled: literal true }`                                                                                                                     |
| `hostBrowserSignInMethod`                     | `host/browser_sign_in`, command                                                                                                                                                              |
| `fcpHostMethodTable`                          | `{ "host/reveal_path", "host/browser_sign_in" } as const`                                                                                                                                    |

## Tests (fcp.test.ts)

Type-level: `FcpMethodParams/Result` infer zod shapes; `ErrorCode` values
unique, `invalid_params` → -32602, `internal` → -32603; each table entry is
the same object as the named export and has the listed kind; sample parses
(`workflow/list` params `{}` → `{}`; `host/browser_sign_in` result
`{ cancelled: true }`).
