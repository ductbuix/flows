# `@workspace/contracts` — node workflows (`src/nodes`) and docket (`src/docket`)

Part of the [contracts spec](contracts.md). Notation as in
[contracts-core.md](contracts-core.md) (`str1`, `int+`, `int0`, `?`).

## src/nodes — files

```
nodes/
  index.ts          barrel (exports listed below)
  define.ts         NodeKindDef type, defineNodeKind(), nodeIdSchema
  common.ts         stepSettings, stepAllowLists, answer declarations
  trigger.ts prompt.ts asset.ts agent.ts command.ts llm.ts judge.ts
  approval.ts output.ts                       one NodeKindDef each
  kinds.ts          NODE_KINDS, nodeSchema (discriminated union)
  limits.ts         NODE_LIMIT, EDGE_LIMIT, DEFAULT_LOOP_PASSES, nodeLimitsSchema
  graph.ts          edgeSchema, PORT_TABLE, edgeProblems, proposeConnectionsUpstream
  workflow-schema.ts workflowSchema (whole-file validation), OLD_WORKFLOW_KEYS
  answers.ts        named answers: parse, format, templates, upstream resolution
  loops.ts          findLoopEdges, loopWarnings
  layout.ts         workflow.layout.json schema
  parse.ts          parseNodeWorkflowYaml (YAML text → workflow + ranged diagnostics)
  yaml-edit.ts      comment-preserving edits of workflow.yaml
```

`nodes/index.ts` exports: `assetResourceSchema`, type `AssetResource`;
`defineNodeKind`, `nodeIdSchema`, types `NodeGroup`, `NodeKindDef`,
`PortType`; `NODE_KINDS`, `nodeSchema`, types `NodeKindName`, `WorkflowNode`;
`DEFAULT_LOOP_PASSES`, `EDGE_LIMIT`, `NODE_LIMIT`, `nodeLimitsSchema`;
`PORT_TABLE`, `edgeProblems`, `edgeSchema`, `portTypeSchema`,
`proposeConnectionsUpstream`, types `NodePorts`, `WorkflowEdge`;
`OLD_WORKFLOW_KEYS`, `workflowSchema`, type `Workflow`.
(The package root re-exports only a subset; see [contracts.md](contracts.md#srcindexts).)

## define.ts

- `PortType = "text" | "file"`; `NodeGroup = "inputs" | "steps" | "flow"`.
- `nodeIdSchema = str1.refine(id => !id.startsWith(".") && !/[/\\]/.test(id),
"node id must be a single path segment")`. Node ids are NOT slug-restricted.
- `NodeKindDef<K, S extends ZodRawShape>` = `{ kind: K; group; ports: { in:
readonly PortType[]; out: readonly PortType[] }; branches?: readonly string[];
files: readonly {path, required}[]; process: "none"|"cli"|"shell";
answers: boolean; settings: S; schema }`.
- `defineNodeKind(def)` fills defaults `files = []`, `process = "none"`,
  `answers = false`, keeps `branches` as given (may be undefined), and builds
  `schema = z.strictObject({ id: nodeIdSchema, kind: z.literal(kind),
name: z.string().optional(), ...settings })`. Every node is strict: unknown
  keys (typos) fail.

## common.ts

- `stepSettings = { timeout: timeoutSecondsSchema?, retry: retrySchema? }`
  (retry = `{ max: int+ default 3 }`).
- `stepAllowLists = { connectors: connectorFileIdSchema[]?, skills: SkillSlug[]? }`.
- `ANSWER_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/`.
- `answerDeclSchema = z.strictObject({ name, type, labels? })`:
  `name` = string regex `ANSWER_NAME_PATTERN`, message
  `"answer name: letters, digits and _, not starting with a digit"`;
  `type` enum `"text","number","yesno","list","choice"`;
  `labels` = `str1[].min(1)?`. superRefine: `choice` without labels →
  `"choice needs labels"` at `["labels"]`; non-choice with labels →
  `"labels are only for choice"` at `["labels"]`. Type `AnswerDecl`.
- `answersSchema = answerDecl[].max(20).refine(unique names, "duplicate answer name")`.

## Node kinds (order of `NODE_KINDS`)

`NODE_KINDS = [trigger, prompt, asset, agent, command, llm, judge, approval,
output] as const`. `NodeKindName` = union of their `kind`.
`nodeSchema = z.discriminatedUnion("kind", NODE_KINDS.map(k => k.schema))`;
`WorkflowNode = z.infer<typeof nodeSchema>`.

All nodes have common keys `id: nodeIdSchema`, `kind: literal`, `name: string?`.

| kind       | group  | ports in → out                        | branches       | files (required?)                       | process | answers | settings (besides common)                                                                                                                                                                                                       |
| ---------- | ------ | ------------------------------------- | -------------- | --------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger`  | inputs | `[]` → `["text"]`                     | —              | —                                       | none    | no      | `type: literal "manual"` (required), `inputs: workflowInputDeclSchema[]?`                                                                                                                                                       |
| `prompt`   | inputs | `[]` → `["text"]`                     | —              | `text.md` (yes)                         | none    | no      | none                                                                                                                                                                                                                            |
| `asset`    | inputs | `[]` → `["text","file"]`              | —              | —                                       | none    | no      | `resources: assetResourceSchema[].default([])`, `items: LibItemId[]?`, `access: enum["read","propose"].default("read")`                                                                                                         |
| `agent`    | steps  | `["text","file"]` → `["text","file"]` | —              | `prompt.md` (yes)                       | cli     | yes     | `cli: enum["claude","cursor"]` (required), `model: modelId?`, `effort: effort?`, `memory: str1[]?`, `answers: answersSchema?`, `connectors?`, `skills?`, `timeout?`, `retry?`                                                   |
| `command`  | steps  | `["text","file"]` → `["text","file"]` | —              | —                                       | shell   | no      | `run: str1`, `timeout?`, `retry?`                                                                                                                                                                                               |
| `llm`      | steps  | `["text","file"]` → `["text"]`        | —              | `prompt.md` (yes), `system.md` (no)     | cli     | yes     | `cli` (required), `model?`, `effort?`, `answers?`, `planReview: enum["auto","ask"]?`, `connectors?`, `skills?`, `timeout?`, `retry?`                                                                                            |
| `judge`    | flow   | `["text","file"]` → `["text","file"]` | `["yes","no"]` | `rule.md` (yes; read in rule mode only) | cli     | no      | `mode: judgeModeSchema?`, `cli: enum?`, `model?`, `effort?`, `check: judgeCheckSchema?`, `timeout?`, `retry?`                                                                                                                   |
| `approval` | flow   | `["text","file"]` → `["text","file"]` | —              | —                                       | none    | no      | `question: str1`                                                                                                                                                                                                                |
| `output`   | flow   | `["text","file"]` → `[]`              | —              | —                                       | none    | no      | `target: enum["folder","publish","notify"]` (required), `latest: boolean?`, `connection: connectionId?`, `title: z.string().trim().min(1).max(120)?`, `channel: noticeChannelSchema?` (`"app"\|"system"`, from `fcp/notice.ts`) |

`assetResourceSchema = z.strictObject({ connection: connectionIdSchema,
entity: str1, id: str1 })` → `AssetResource`.

Exported internal names: `triggerKind`, `promptKind`, `assetKind`,
`agentKind`, `commandKind`, `llmKind`, `judgeKind`, `approvalKind`,
`outputKind` (exported from their files, not from the barrel).

## judge.ts

| Export                         | Value                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHECK_OPERATORS`              | `["=","!=",">",">=","<","<=","contains","set","unset"] as const`; `CheckOperator` type                                                                                                             |
| `NUMBER_OPERATORS`             | `[">",">=","<","<="]`                                                                                                                                                                              |
| `UNARY_OPERATORS`              | `["set","unset"]`                                                                                                                                                                                  |
| `judgeCheckSchema`             | `z.strictObject({ field: string regex ANSWER_NAME_PATTERN msg "field: the name of an upstream answer", operator: z.enum(CHECK_OPERATORS), value: (string \| number \| boolean)? })` → `JudgeCheck` |
| `judgeModeSchema`              | enum `"rule","check"`                                                                                                                                                                              |
| `judgeKind`                    | above                                                                                                                                                                                              |
| `judgeSettingProblems(node)`   | returns `{ key, message }[]`, below                                                                                                                                                                |
| `evaluateCheck(check, actual)` | boolean, below                                                                                                                                                                                     |

`judgeSettingProblems` (mode defaults to `rule`):

- rule mode: `cli` undefined → `{cli, "judge needs cli"}`; `check` defined →
  `{check, "check is only for mode: check"}`; return.
- check mode: no `check` → `"check mode needs check"`. Otherwise for a unary
  operator with a value → `` `${op} takes no value` ``; non-unary without
  value → `` `${op} needs a value` ``; number operator whose value is not
  numeric (see toNumber) → `` `${op} needs a number` `` (all key `check`).
  Then for each of `cli`, `model`, `effort` that is defined →
  ``{ key, `${key} is only for mode: rule` }``.

Helpers (private): `toNumber(v)`: finite number → itself; non-blank string →
`Number(v)` if finite; else undefined. `asText(v)`: boolean → `yes`/`no`;
array → `map(String).join(", ")`; else `String(v ?? "").trim()`.
`same(a,b)`: if `a` is a number and `b` numeric → numeric equality; else
compare `asText(...).toLowerCase()` with `true`→`yes`, `false`→`no`.
`isSet(v)`: false for undefined/null, empty array, blank string; else true.

`evaluateCheck`: `set` → isSet; `unset` → !isSet; `=` → isSet && same;
`!=` → !(isSet && same); `contains` → false if unset; needle =
`asText(value).toLowerCase()`; arrays: some item's lowercased text equals
needle; else lowercased text includes needle. Number operators: both sides
via toNumber, false if either undefined, else compare.

## limits.ts

`NODE_LIMIT = 200`, `EDGE_LIMIT = 400`, `DEFAULT_LOOP_PASSES = 5`.
`nodeLimitsSchema = z.strictObject({ concurrency: int+?, agents: int+?,
maxConcurrentRuns: int+?, loopPasses: int+.default(5) })`.

## layout.ts

`layoutFileSchema = z.object({ version: z.literal(1).default(1), nodes:
record<string, { x: number, y: number }>, viewport: { x, y, zoom: number }? })`
→ `LayoutFile`. File `workflow.layout.json`, editor-only positions.

## graph.ts

- `portTypeSchema = z.enum(["text","file"])`.
- `edgeSchema = z.strictObject({ from: str1, to: str1, port: portType?,
branch: str1? })` → `WorkflowEdge`. Port defaults to `text` in all logic.
- `NodePorts = { in; out; branches? }`; `PORT_TABLE: Record<string, NodePorts>`
  built from `NODE_KINDS` (`{ in, out, branches }` per kind).
- `edgeProblems(nodes, edges)` → `{ index, message }[]`; per edge, in order:
  1. unknown `from` → `` `unknown node id ${from}` ``; unknown `to` → same with `to`.
  2. if from-kind has branches: missing branch or not in list →
     `` `edge out of ${fromKind} needs branch ${branches.join(" or ")}` ``
     (judge: `needs branch yes or no`); else if branch given →
     `` `branch is not allowed on edges out of ${fromKind}` ``.
  3. if from-kind has no branches and its `out` lacks port →
     `` `${fromKind} has no out port ${port}` `` (branch kinds skip this check).
  4. if to-kind `in` lacks port → `` `${toKind} has no in port ${port}` ``.
  5. key `from|to|port|branch??""` seen before → `"duplicate edge"`.
- `proposeConnectionsUpstream(nodes, edges, nodeId)`: ancestors of `nodeId`
  (reverse BFS over all edges); collect `resources[].connection` of every
  ancestor `asset` node with `access === "propose"`; return sorted unique list.

## workflow-schema.ts

- `OLD_WORKFLOW_KEYS = ["tasks","needs","when","repeat","approval","spawn","uses"] as const`.
- Object schema (private `nodeWorkflowObjectSchema`, `z.strictObject`):

| key       | schema                                     |
| --------- | ------------------------------------------ |
| `id`      | `str1` (not slug-checked here)             |
| `name`    | `z.string().trim().min(1).max(80)?`        |
| `goal`    | `string?`                                  |
| `limits`  | `nodeLimitsSchema?`                        |
| `timeout` | `timeoutSecondsSchema?`                    |
| `agent`   | `workflowAgentSchema?`                     |
| `nodes`   | `nodeSchema[].max(NODE_LIMIT)` (required)  |
| `edges`   | `edgeSchema[].max(EDGE_LIMIT).default([])` |

- `superRefine` adds `code: "custom"` issues in this order:
  1. Duplicate node id → `` `duplicate node id ${id}` `` at `["nodes", i, "id"]` (second and later).
  2. Approval questions as template texts (`{ nodeId, label: "question", text: question }`)
     through `templateProblems`; each → `` `${label}: ${message}` `` at
     `["nodes", indexOfNode, "question"]`.
  3. For each judge: each `judgeSettingProblems` entry at `["nodes", i, key]`;
     and when `mode === "check"` and `check` set: sources =
     `upstreamAnswerSources(...).get(check.field) ?? []`; if count ≠ 1:
     0 → `` `check field ${field}: no upstream node declares it` ``;
     > 1 → `` `check field ${field} is ambiguous: ${from.join(" and ")} both declare it` ``,
     > at `["nodes", i, "check", "field"]`.
  4. Output problems (per output node i):
     `title` set and target ≠ notify → `"title is only for the notify target"` at `[nodes,i,title]`;
     `channel` set and target ≠ notify → `"channel is only for the notify target"`;
     target ≠ publish and `connection` set → `"connection is only for the publish target"`;
     target publish without connection → `"publish needs a connection"`;
     publish whose connection is not in `proposeConnectionsUpstream(nodes, edges, id)` →
     `` `publish to ${connection} needs an upstream Asset with propose access to it` ``.
  5. Each `edgeProblems` entry at `["edges", index]`.
- `oldKeysGuard = z.unknown().check(ctx => …)`: if value is a non-null object
  and contains the first key from `OLD_WORKFLOW_KEYS` (in list order), push
  issue `{ code: "custom", message: `old workflow format: key "${key}" is not supported; use nodes and edges`, input, continue: false }`.
- `workflowSchema = oldKeysGuard.pipe(nodeWorkflowObjectSchema)`;
  `Workflow = z.infer<typeof nodeWorkflowObjectSchema>`.
- Cycles are allowed by the schema (loops are a feature).

## answers.ts

Re-exports `ANSWER_NAME_PATTERN`, `answersSchema`, `answerDeclSchema`, type
`AnswerDecl` from common.ts.

| Export                                                | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AnswerValues`                                        | `Record<string, unknown>`                                                                                                                                                                                                                                                                                                                                                                                                            |
| `AnswerParse`                                         | `{ ok: true; value } \| { ok: false; error: string }`                                                                                                                                                                                                                                                                                                                                                                                |
| `answerTypeHint(d)`                                   | text `"a string"`, number `"a number"`, yesno `"true or false"`, list `"an array of strings"`, choice `` `one of ${labels.map(JSON.stringify).join(", ")}` ``                                                                                                                                                                                                                                                                        |
| `parseAnswer(decls, input)`                           | non-object/null/array → error `"the answer must be a JSON object"`. For each decl: missing key → `` `${name}: missing` ``; wrong type → `` `${name}: ${msg}` `` with msg: text `"must be a string"`, number `"must be a number"` (finite only, NaN fails), yesno `"must be true or false"`, list `"must be an array of strings"`, choice `` `must be one of ${labels.join(", ")}` ``. Problems joined by `"; "`. Extra keys dropped. |
| `parseAnswerText(decls, text)`                        | candidates (latest first): bodies of fenced blocks matching `/```(?:json)?\s*\n([\s\S]*?)```/gi` (trimmed, reversed), then whole trimmed text, then the slice after the last `"\n{"` in trimmed text. Try `JSON.parse` each (skip failures); first `parseAnswer` ok wins; else last failed parse result, or `"no JSON answer found"`                                                                                                 |
| `formatAnswerValue(v)`                                | boolean → yes/no; array → `join(", ")`; else `String(v ?? "")`                                                                                                                                                                                                                                                                                                                                                                       |
| `answerText(decls, value)`                            | `name: formatted` lines joined by `\n`, plus trailing `\n`                                                                                                                                                                                                                                                                                                                                                                           |
| `templateNames(text)`                                 | unique names from `/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g`, first-use order                                                                                                                                                                                                                                                                                                                                                       |
| `fillTemplate(text, values)`                          | replace each match with formatted value when `name in values`; else leave as written                                                                                                                                                                                                                                                                                                                                                 |
| `declaredAnswers(node)`                               | `node.answers ?? []`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `upstreamAnswerSources(nodes, edges, nodeId)`         | `Map<name, nodeId[]>` over all strict ancestors (self removed even in a cycle), in node order                                                                                                                                                                                                                                                                                                                                        |
| `TemplateText` / `TemplateProblem`                    | `{ nodeId, label, text }` / `{ nodeId, label, message }`                                                                                                                                                                                                                                                                                                                                                                             |
| `templateProblems(nodes, edges, texts)`               | for each text, each template name with >1 source → `` `{{${name}}} is ambiguous: ${from.join(" and ")} both declare it` ``; undeclared names are fine                                                                                                                                                                                                                                                                                |
| `resolveAnswerValues(nodes, edges, nodeId, answerOf)` | for each unambiguous upstream name, `answerOf(sourceId)?.[name]` when defined                                                                                                                                                                                                                                                                                                                                                        |

## loops.ts

- `findLoopEdges(nodes: {id, kind?}[], edges: {from,to}[]) → Set<number>`
  (edge indexes). Ignore edges with unknown ends. Adjacency per node sorted by
  target's node-file order, then edge index. DFS (states stack/done) from
  every node with no incoming edge, in file order; then from any unvisited
  node in file order. An edge to a node on the stack is a loop edge (includes
  self edges).
- `loopWarnings(nodes, edges)` → `{ index, message }[]`: for each loop edge
  (ascending index), the cycle = nodes reachable forward from `to` and
  backward from `from` over non-loop edges; if none is kind `judge` →
  `` `loop ${from} -> ${to} has no Judge to end it; it stops only at the loop limit` ``.

## parse.ts

Types `NodeYamlDiagnostic = { message; path: (string|number)[]; from; to;
severity: "error" }`, `ParsedNodeWorkflowYaml = { workflow: Workflow | null; errors }`.

`parseNodeWorkflowYaml(text)`:

1. `parseDocument(text, { keepSourceTokens: true, strict: false })`.
2. YAML errors → diagnostics with `path: []`, `from = err.pos[0] ?? 0`,
   `to = max(err.pos[1] ?? from, from + 1)`; if any, return `workflow: null`.
3. `workflowSchema.safeParse(doc.toJS({ maxAliasCount: 1000 }))`; success →
   `{ workflow, errors: [] }`.
4. Else per issue: path filtered to string/number; range = deepest existing
   node on that path prefix (walk from full path to root, `doc.getIn(prefix,
true)`) with `range` → `[r0, max(r1, r0+1)]`; none → `[0, min(1, text.length)]`.

## yaml-edit.ts (workflow.yaml)

All parse with `parseDocument(text, { keepSourceTokens: true })` (strict
default) and return `doc.toString()`; a missing target returns the input
unchanged. Nodes are found by `String(map.get("id")) === id` in `nodes` seq.
Edge match: same `from`, `to`, `port ?? "text"`, `branch ?? ""`.

| Function                                                     | Behavior                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `addNode(text, node)`                                        | create `nodes: []` if missing/not a seq; if empty set `flow = false` (block list); append                                                |
| `removeNode(text, id)`                                       | delete node and every edge whose `from` or `to` is `id`                                                                                  |
| `renameNode(text, fromId, toId)`                             | set node `id`; rewrite scalar `from`/`to` values equal to `fromId`                                                                       |
| `setNodeKey(text, id, key, value)`                           | `undefined` deletes key; else `set(key, createNode(value))`                                                                              |
| `addEdge(text, edge)`                                        | create `edges` if missing; empty → block; existing match → return input; new item is a flow map (`{ from: t, to: t }` style)             |
| `removeEdge(text, edge)`                                     | delete first match                                                                                                                       |
| `setWorkflowField(text, field: "id"\|"name"\|"goal", value)` | `undefined`/`null` deletes; new `name` (absent before) inserted right after the `id` pair (index of id + 1; at 0 if no id); else `setIn` |
| `replaceMemoryRef(text, fromPath, toPath)`                   | in every node's `memory` seq, replace items equal to `fromPath`                                                                          |

Test: `addNode("id: a\nnodes: []\nedges: []\n", …)` yields `nodes:\n  - `;
following `addEdge(t→t)` yields `edges:\n  - { from: t, to: t }`.

## src/docket — files

```
docket/
  index.ts      barrel
  schemas.ts    card / board / ref / asset / link schemas
  parse.ts      tolerantParseCard, tolerantParseBoard
  yaml-edit.ts  patchYamlMapping, card.md split/join/patch, yamlMappingToJs
```

Barrel exports: `cardIdSchema, cardLinkRelSchema, refSchema,
assetScopeSchema, assetSchema, cardLinkSchema, cardSchema,
boardColumnSchema, boardSchema`, types `DocketRef, DocketAsset, CardLink,
Card, BoardColumn, Board`; `tolerantParseCard, tolerantParseBoard`, type
`TolerantParseResult`; `patchYamlMapping, splitCardMd, joinCardMd,
patchCardMd, yamlMappingToJs`.

### schemas.ts

All objects are `.passthrough()` (unknown keys kept) unless noted.

| Export              | Shape                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cardIdSchema`      | `str1.regex(slug, "lowercase letters, digits and dashes")`                                                                                                                                                                                                                |
| `cardLinkRelSchema` | enum `"relates","blocks","parent","duplicates"`                                                                                                                                                                                                                           |
| `refSchema`         | `{ system: str1, kind: str1?, id: str1?, url: str1?, label: string?, syncedAt: string?, snapshot: string? }` → `DocketRef`                                                                                                                                                |
| `assetScopeSchema`  | enum `"owned","linked"`                                                                                                                                                                                                                                                   |
| `assetSchema`       | `{ path: str1, label: string?, scope: assetScope? }` → `DocketAsset`                                                                                                                                                                                                      |
| `cardLinkSchema`    | `{ to: cardIdSchema, rel: cardLinkRel }` → `CardLink`                                                                                                                                                                                                                     |
| `cardSchema`        | `{ id: cardId, title: str1, status: string, created: string, updated: string, rank: string?, start: string?, due: string?, done: (string \| null)?, refs: ref[]?, assets: asset[]?, links: cardLink[]?, fields: record<string,unknown>? }` → `Card` (card.md frontmatter) |
| `boardColumnSchema` | `{ id: str1, label: str1, done: boolean? }` → `BoardColumn`                                                                                                                                                                                                               |
| `boardSchema`       | `{ version: literal 1, columns: boardColumn[].min(1), face: str1[].max(2).optional().default([]) }` → `Board` (board.yaml)                                                                                                                                                |

### parse.ts

`TolerantParseResult<T> = { data: T | null; warnings: string[] }`.
Issue summary format: `` `${path.join(".") || "(value)"}: ${message}` ``.

`tolerantParseCard(input)`:

1. Non-plain-object → `{ data: null, warnings: ["(root): expected object"] }`.
2. Required keys `id,title,status,created,updated` (in order): missing →
   `` `${key}: required` ``; invalid → `` `${key}: ${summaries joined "; "}` ``.
   Any failure → `data: null` with all warnings.
3. `data = { ...input, ...parsedRequired }` (unknown keys kept).
4. `refs`, `assets`, `links`: if present but not array → warning
   `` `${key}: expected array` `` and key removed; else each entry safeParsed,
   bad ones dropped with `` `${key}[${i}]: ${summaries}` ``.
5. `fields` present and not plain object → `"fields: expected object"`, removed.
6. Date keys `created, updated, start, due, done`: string values where
   `Date.parse` is NaN → `` `${key}: expected ISO date, got ${JSON.stringify(v)}` ``
   (warning only; value kept). Same for `refs[i].syncedAt` →
   path `refs[${i}].syncedAt`.

`tolerantParseBoard(input)`:

1. Non-object → `"(root): expected object"`, null.
2. `version` missing → `["version: required"]`; not literal 1 →
   `` `version: ${issue.message}` `` each; null.
3. `columns` missing → `["columns: required"]`; not array → warnings +
   `"columns: expected array"`, null; entries parsed tolerant (bad dropped,
   `columns[i]: …`); zero kept → warnings + `"columns: need at least one"`, null.
4. `data = { ...input, version: 1, columns, face: [] }`; if `face` present:
   not array → `"face: expected array"` (face stays `[]`); else keep non-empty
   strings (bad → `` `face[${i}]: ${firstIssueMessage}` ``); more than 2 →
   `"face: at most 2 entries; keeping first 2"` and truncate.

### yaml-edit.ts (docket)

Documents parsed with `{ keepSourceTokens: true, strict: false }`.

- `patchYamlMapping(yamlText, patch)`: for each entry, `undefined` →
  `deleteIn([key])`, else `setIn([key], createNode(value))`; returns
  `toString()` (comments, order, unknown keys kept).
- `CARD_MD_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/`.
  `splitCardMd(text)` → `{ frontmatter, body }` or `null` when no match.
- `joinCardMd(fm, body)` → `` `---\n${fm without one trailing \n}\n---\n\n${body without one leading \n}` ``.
  Round-trips `splitCardMd` for files written as `---\n…\n---\n\nbody`.
- `patchCardMd(text, frontmatterPatch, body?)`: split (no match → input
  unchanged), patch frontmatter, join with `body ?? split.body`.
- `yamlMappingToJs(yamlText)` → `{ value, error? }`: YAML errors →
  `{ value: undefined, error: messages joined "; " }`; empty contents →
  `{ value: undefined, error: "empty document" }`; else
  `{ value: doc.toJS({ maxAliasCount: 1000 }) }`.
