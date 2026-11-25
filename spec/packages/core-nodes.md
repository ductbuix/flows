# core: nodes (NodeKind, StepContext, effect runner, kinds)

Part of the [`@workspace/core` spec](core.md). Covers `src/nodes/`.

A `NodeKind` is a zod settings schema plus an async-generator `execute(ctx)`
yielding `StepEvent`s. `createNodeEffectRunner` is the `runEffect` callback
the host gives to `RunActor` (see [core-runs.md](core-runs.md)); it maps a
`RunEffect` to an `EffectResult` by running a kind, a shell command, or a
folder copy. All file I/O goes through `DocumentStore` with
**store-relative** paths (relative to `FLOWAPP_HOME`).

## Store layout used by nodes

Given `runDir` (e.g. `workflows/<wf>/runs/<runId>`, from `runDirOf(state)`):

| Path                                                               | Meaning                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `<runDir>/input/**`                                                | run start input (`text.md` and files)                        |
| `<runDir>/resources.json`                                          | pinned resources `{ pins: Pin[] }`                           |
| `<runDir>/resources/<conn>/<entity>/<idSeg>[/...]`                 | frozen pinned resources (read access)                        |
| `<runDir>/work/<conn>`                                             | propose-access work copy (command env only)                  |
| `<runDir>/nodes/<id>/frozen/{prompt.md,system.md,rule.md,text.md}` | frozen node texts                                            |
| `<runDir>/nodes/<id>/pass-<n>/`                                    | step folder (`stepDir`); `.keep` written at context creation |
| `<stepDir>/text.md`                                                | the step's main result                                       |
| `<stepDir>/files/**`                                               | additional result files                                      |
| `<stepDir>/attempt-<k>/{events.log,stdout.log,stderr.log,out/}`    | attempt logs and command `NODE_OUT`                          |
| `<stepDir>/out/answer.json`, `<stepDir>/answer-error.txt`          | agent answers and the one-fix marker                         |
| `<stepDir>/input/memory/<name>`                                    | copied agent memory files                                    |
| `<runDir>/output/<from>/<name>`                                    | folder output copies                                         |

Output paths reported in `step_done.outputs` are **run-relative**
(`nodes/<id>/pass-<n>/<rel>`).

## Files

| File                     | Purpose                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`               | barrel                                                                                                                   |
| `types.ts`               | `PortSpec`, `StepInput`, `StepEvent`, `AskPending`, `isAskPending`, `StepContext`, `NodeKind`                            |
| `define.ts`              | `defineNodeKind` (identity)                                                                                              |
| `registry.ts`            | `NodeKindRegistry`, `createNodeKindRegistry`, `kindKeyForNode`                                                           |
| `builtins.ts`            | `CORE_NODE_KINDS`, `createCoreNodeRegistry`                                                                              |
| `context.ts`             | `createStepContext`, `loadRunInputs`, `loadStepInputs`, `StepContextDeps`                                                |
| `input-sources.ts`       | `resolveInputSources` (data passing through gates and loops)                                                             |
| `run.ts`                 | `createNodeEffectRunner`; re-exports builtins, `collectExecute`, dep types                                               |
| `run-deps.ts`            | `NodeEffectRunnerDeps`, `NoticePost`                                                                                     |
| `run-kind-effect.ts`     | `runKindEffect` (drive a registered kind for `launch_step`)                                                              |
| `collect-execute.ts`     | `collectExecute` (StepEvents → EffectResult)                                                                             |
| `command-effect.ts`      | `runCommandEffect` (`command` nodes via ProcessRunner)                                                                   |
| `write-output-effect.ts` | `runWriteOutputEffect` (folder output)                                                                                   |
| `attempt-log.ts`         | `LogEntry`, `appendLogEntry` (NDJSON activity log)                                                                       |
| `tool-log.ts`            | `commandOf`, `logPrompt`, `logToolEvent`, `ToolMap`                                                                      |
| `agent-prompt.ts`        | `llmProfileId`, `llmPromptText`, `inputUri`, `llmContentBlocks`                                                          |
| `agent-reply.ts`         | `createReply`, `logNarration`                                                                                            |
| `agent-answer.ts`        | answers: `ANSWER_ERROR_FILE`, `nodeAnswerDecls`, `agentAnswerPrompt`, `agentFixPrompt`, `settleAnswer`, `readStepAnswer` |
| `agent-memory.ts`        | `copyAgentMemories`                                                                                                      |
| `asset-items.ts`         | asset settings + library-item / fixed-path / produced helpers                                                            |
| `asset-resources.ts`     | `emitFixedResources` (pinned connector resources)                                                                        |
| `publish-gate.ts`        | `needsPersonGate`                                                                                                        |
| `kinds/*.ts`             | the ten built-in kinds                                                                                                   |

`nodes/index.ts` exports: `AskPending`, `isAskPending`, `NodeKind`,
`PortSpec`, `StepContext`, `StepEvent`, `StepInput`, `defineNodeKind`,
`createNodeKindRegistry`, `kindKeyForNode`, `NodeKindRegistry`,
`createStepContext`, `loadRunInputs`, `loadStepInputs`, `StepContextDeps`,
`CORE_NODE_KINDS`, `collectExecute`, `createCoreNodeRegistry`,
`createNodeEffectRunner`, `NodeEffectRunnerDeps`, `NoticePost`,
`runCommandEffect`, `CommandEffectDeps`, `runWriteOutputEffect`,
`WriteOutputEffectDeps`, `triggerKind`, `promptKind`, `assetKind`,
`agentKind`, `llmKind`, `llmContentBlocks`, `llmProfileId`, `llmPromptText`,
`CONDITION_BRANCHES`, `conditionBranch`, `conditionKind`, `ConditionBranch`,
`judgeCheckKind`, `approvalKind`, `notifyKind`, `publishKind`,
`agentAnswerPrompt`, `agentFixPrompt`, `ANSWER_ERROR_FILE`,
`nodeAnswerDecls`, `readStepAnswer`, `settleAnswer`, `SettleAnswerResult`,
`copyAgentMemories`, `needsPersonGate`. (The package root re-exports all of
these except `promptKind`, `runWriteOutputEffect` and
`WriteOutputEffectDeps`.)

## Types (`types.ts`)

```ts
type PortSpec = "text" | "image" | "any" | "file"
type StepInput = {
  from: string            // source node id, or "input" for run input files
  path: string            // store-relative
  name: string            // relative to the source step/input folder
  text?: string
  role?: "result" | "feedback"
}
type StepEvent =
  | { kind: "output_written"; path: string }
  | { kind: "notify"; title: string; text: string; channel?: "app" | "system" }
  | { kind: "waiting"; question: string }
  | { kind: "done"; outputs?: string[]; branch?: string; answer?: Record<string, unknown> }
  | { kind: "failed"; reason: "exit" | "timeout" | "unclear" | "answer"; message?: string }
class AskPending extends Error {   // name "AskPending", message `waiting: ${question}`
  readonly question: string
}
isAskPending(e): e is AskPending   // instanceof
type StepContext<S> = {
  settings: S; inputs: readonly StepInput[]
  runDir: string; stepDir: string          // store-relative; stepDir = runDir/nodes/<id>/pass-<n>
  signal: AbortSignal; answers: Record<string, unknown>
  decision?: "approved" | "rejected"; runId?: string
  graph: { id: string; name?: string }; node: { id: string; name?: string; pass: number }
  inbox: { ask(question: string): Promise<"approved" | "rejected"> }
  agent: { session(spec: SessionSpec): Promise<AgentSession> }
  log(entry: Omit<LogEntry, "at">): void
  outputs: { write(relPath: string, text: string): Promise<string> }   // returns run-relative path
  docs: { read(path): { text } | null; list(glob): string[]; write(path, text): void; remove(path): void }
  publish?: PublishPort
}
type NodeKind<S = unknown> = {
  kind: string; settings: z.ZodType<S>
  ports: { in: PortSpec[]; out: PortSpec[] }
  execute(ctx: StepContext<S>): AsyncIterable<StepEvent>
}
defineNodeKind<S>(def): NodeKind<S>    // returns def unchanged
```

## Registry (`registry.ts`, `builtins.ts`)

`NodeKindRegistry`: `register(kind): this` (last wins), `get(kind)`,
`kinds()` (insertion order). `createNodeKindRegistry(kinds = [])`.

`kindKeyForNode(node: {kind, target?, mode?})`:

| Workflow node                          | Registry key                            |
| -------------------------------------- | --------------------------------------- |
| `output` + `target: "notify"`          | `notify`                                |
| `output` + `target: "publish"`         | `publish`                               |
| other `output` (folder)                | `undefined` (handled as `write_output`) |
| `judge` + `mode: "check"`              | `judge`                                 |
| `judge` otherwise (rule mode, default) | `condition`                             |
| anything else                          | `node.kind`                             |

`CORE_NODE_KINDS` (order): trigger, prompt, asset, agent, llm, condition,
judge (check), approval, notify, publish. `createCoreNodeRegistry(extra =
[])` registers those then `extra`. `command` has no NodeKind: it is handled
by `runCommandEffect`.

## Step context (`context.ts`)

```ts
type StepContextDeps = {
  docs: DocumentStore; runDir: string; nodeId: string; pass: number
  attempt?: number                  // unset → log() is a no-op
  settings: unknown; inputs: readonly StepInput[]
  answers?: Record<string, unknown>; decision?: "approved" | "rejected"
  graph: { id; name? }; nodeName?: string; signal?: AbortSignal
  resolveAsk?: "approved" | "rejected"
  agentCwd?: string                 // absolute cwd for agent sessions
  agentRuntime?: AgentRuntime; runId?: string
  acpAsks?: AcpInboxGates; planReview?: "auto" | "ask"; publish?: PublishPort
}
createStepContext<S>(deps & { settings: S }): StepContext<S>
```

- Writes `${stepDir}/.keep` = `""` immediately (so the folder exists as an
  ACP cwd).
- `signal` defaults to a fresh never-aborted signal; `answers` to `{}`.
- `inbox.ask(q)`: returns `resolveAsk` if set, else `decision` if set, else
  throws `AskPending(q)`.
- `agent.session(spec)`: throws `Error("agent runtime is not configured")`
  without a runtime. `cwd = agentCwd || spec.cwd || stepDir`. When both
  `acpAsks` and `runId` are set, merges `acpSessionHandlers({runId, nodeId,
pass, attemptRoot: cwd, gates: acpAsks, planReview?})` (see
  [core-agents.md](core-agents.md)) into the spec. Calls
  `agentRuntime.open({...spec, ...handlers, cwd}, signal)`.
- `log(entry)`: `appendLogEntry(docs, ${stepDir}/attempt-${attempt}, entry)`
  when `attempt` is defined.
- `outputs.write(rel, text)`: writes `${stepDir}/${rel}` (collapsing repeated
  `/`), returns `nodes/<id>/pass-<n>/<rel>`.
- `docs.*`: thin pass-through (`read` returns only `{text}`).
- `runId` and `publish` keys are present only when given.

`loadRunInputs(docs, runDir)`: every file listed by `${runDir}/input/**`
under the `input/` prefix (non-empty name, not ending `/`) as `{from:
"input", path, name, text?}`, sorted by `name.localeCompare`.

`loadStepInputs(docs, runDir, sources: InputSource[])`: for each source,
`base = nodes/<from>/pass-<pass>`; names = recorded `outputs` under `base/`
(or just `text.md` when `outputs` is undefined) ∪ every file under
`${runDir}/${base}/files/**`. Sorted with `text.md` first then
`localeCompare`; unreadable files skipped; each becomes `{from, path, name,
text, role}`. Attempt logs, `out/`, scratch files are never inputs.

## Data passing (`input-sources.ts`)

```ts
type InputSource = { from: string; pass: number; outputs?: readonly string[]; role: "result" | "feedback" }
resolveInputSources(state: RunState, nodeId: string): InputSource[]
```

Gate kinds: `judge`, `approval`. Recursive `visit(to, direct)` over edges
into `to` in file order:

- Source step: if `direct`, the source's latest step only if `done`; behind
  a gate (`direct = false`), the **latest done pass** of the source (the one
  the gate saw, since the source may be running its next pass).
- Skip when no step or the edge has a branch not equal to the step's branch.
- Non-gate source → add `{from, pass, outputs?, role: "result"}`.
- Gate source → visit the gate's inputs once (`direct = false`, tracked in a
  `gates` set); additionally, when `direct` and the gate is a `judge` and
  this edge is a loop edge, add the judge step itself with role `feedback`.
- Dedup key `${role}:${from}:${pass}`.

Result: nodes after a judge/approval read the gated results by reference
(never copies); a node looped back to by a judge also gets the judge's
verdict as feedback; logs never pass.

## Effect runner (`run.ts`, `run-deps.ts`)

```ts
type NoticePost = {
  key: string; title: string; text: string; runId: string; workflowId: string
  nodeId: string; at: string; channel?: "app" | "system"
}
type NodeEffectRunnerDeps = {
  docs: DocumentStore; registry?: NodeKindRegistry
  runDirOf: (state: RunState) => string
  postNotice?: (n: NoticePost) => void
  now?: () => string                                        // default new Date().toISOString()
  agentCwdOf?: (state, nodeId, pass) => string
  agentRuntime?: AgentRuntime
  process?: ProcessRunner; workflowDirOf?: (state) => string
  processEnv?: Readonly<Record<string, string | undefined>>
  absolutePathOf?: (storePath: string) => string
  signalOf?: (state) => AbortSignal | undefined
  acpAsks?: AcpInboxGates; publish?: PublishPort
}
createNodeEffectRunner(deps): (effect: RunEffect, state: RunState) => Promise<EffectResult>
```

Dispatch (registry defaults to `createCoreNodeRegistry()`):

| Effect         | Behaviour                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `post_inbox`   | returns `{waiting: true, question}` (the actor ignores the result)                                                                                                                               |
| `notify`       | `postNotice({key: "runId:nodeId:pass", title, text: "", runId, workflowId, nodeId, at: now()})`; returns `{ok: true, outputs: []}`                                                               |
| `write_output` | `runWriteOutputEffect`                                                                                                                                                                           |
| `launch_step`  | `runKindEffect`; if it returns `null` (no registered kind) and node is `command` with `process` and `workflowDirOf` → `runCommandEffect`; otherwise stub `{ok: true, outputs: ["out/<nodeId>"]}` |
| other          | `{ok: false, reason: "exit"}`                                                                                                                                                                    |

### runKindEffect

1. Node missing → `{ok:false, reason:"exit"}`. No registered kind for
   `kindKeyForNode(node)` → `null`.
2. Inputs: `trigger` → `loadRunInputs`; others → `loadStepInputs(...,
resolveInputSources(state, nodeId))`.
3. `kind.settings.safeParse({...node})`; failure → `{ok:false,
reason:"exit"}`.
4. `answers = resolveAnswerValues(graph.nodes, graph.edges, nodeId, id =>
latestStep(id)?.answer)` (contracts: answers of upstream nodes by name).
5. `planReview` taken from parsed settings when `"auto"`/`"ask"`.
6. `createStepContext({... runId, attempt, decision: latestStep.decision,
graph: {id, name}, nodeName, agentRuntime, agentCwd: agentCwdOf?.(),
acpAsks, publish, planReview?, signal: signalOf?.(state)})`.
7. `result = collectExecute(kind.execute(ctx))`. For agent-like kinds (`llm`,
   `agent`, `condition`): on a thrown non-`DOMException` error write
   `attempt-<k>/stderr.log` = stack/message and append an `error` log entry
   ("Agent failed", status `failed`), then rethrow; on success write
   `attempt-<k>/stdout.log` = the step's `text.md` (or `""`); on `{ok:false}`
   write `stderr.log` = `message ?? "Failed: <reason>"` plus an error log
   entry.
8. An `{ok:true}` result with `notice` → `postNotice({key, title, text,
runId, workflowId, nodeId, at: now(), channel?})` and return `{ok:true,
outputs}` **without** `notice` (so decide does not also emit a `notify`
   effect).

### collectExecute (`collect-execute.ts`)

Iterates events, accumulating `outputs` (from `output_written` and
`done.outputs`), the last `notify` as `notice`, and `done.branch/answer`:

- `waiting` → return `{waiting: true, question}` immediately.
- `failed` with `message === "fix"` → `{fix: true}`; other `failed` →
  `{ok:false, reason, message?}` immediately.
- A thrown `AskPending` → `{waiting: true, question}`; other throws propagate.
- End → `{ok: true, outputs: dedup(outputs), branch?, answer?, notice?}`
  (`branch`/`answer` only when truthy).

### runCommandEffect (`command-effect.ts`)

```ts
type CommandEffectDeps = {
  docs
  process: ProcessRunner
  runDirOf
  workflowDirOf
  absolutePathOf?: (storePath) => string // default identity
  baseEnv?: Readonly<Record<string, string | undefined>>
  signalOf?: (state) => AbortSignal | undefined
  now?: () => string
}
```

1. Node must be `command` with non-empty string `run`, else `{ok:false,
reason:"exit"}`.
2. `attemptRoot = <stepDir>/attempt-<k>`, `outDir = <attemptRoot>/out`;
   write `<outDir>/.keep`.
3. Spawn `{command: "/bin/sh", args: ["-c", run], cwd: abs(workflowDir),
env: {...baseEnv, ...assetResourceEnv, RUN_ID, WF_DIR: abs(workflowDir),
NODE_ID, NODE_OUT: abs(outDir)}}` with `signalOf(state)` (or a fresh
   signal). No sandbox profile is passed.
   - `assetResourceEnv`: for every `asset` node that is an ancestor (any
     path over edges) of this node, for each `resources[]` entry, env
     `connectionEnvName(conn)` (`RESOURCE_` + id with `-`→`_`, uppercased) =
     `<abs(runDir)>/<work|resources>/<conn>` (`work` when `access:
"propose"`).
4. Read stdout and stderr fully (UTF-8), await exit. Write
   `attempt/stdout.log`, `attempt/stderr.log`, and append a `command` log
   entry (`at: startedAt, title: run, command: run, status: ok|failed, text:
non-blank stdout/stderr joined by "\n"`).
5. If the signal aborted → throw `DOMException("cancelled", "AbortError")`
   (the actor leaves the step for the queued cancel).
6. Exit ≠ 0 → `{ok:false, reason:"exit", attempt: {attempt, exitCode,
endedAt: now()}}` (enables retry backoff in decide).
7. Exit 0 → write `<stepDir>/text.md` = stdout; copy each file under
   `<outDir>/` (except `.keep`) to `<stepDir>/files/<name>`; return
   `{ok:true, outputs: ["nodes/<id>/pass-<n>/text.md", ...files/<name>]}`.

Test invariant: a failing command fails the step; its successors are
skipped and the run ends `failed`.

### runWriteOutputEffect (`write-output-effect.ts`)

Sources = `resolveInputSources` filtered to role `result`; for each loaded
input write `<runDir>/output/<from>/<name>` = text (or `""`) and record
`output/<from>/<name>`. Returns `{ok: true, outputs}` synchronously.

### Activity log (`attempt-log.ts`, `tool-log.ts`)

```ts
type LogEntry = {
  at: string; id?: string                       // later entries with the same id replace earlier ones (reader side)
  kind: "command" | "tool_call" | "message" | "error"
  title: string; command?: string; status?: string; text?: string
}
appendLogEntry(docs, attemptRoot, entry: Omit<LogEntry,"at"> & { at?: string }): void
```

Appends one JSON line to `<attemptRoot>/events.log` (read-modify-write).
`text` longer than 8000 chars is cut to 8000 + `"\n… truncated"`. `at`
defaults to `new Date().toISOString()`.

`commandOf(input)`: `input.command` string, or array joined by spaces.
`logPrompt(ctx, {cli, model?, effort?}, mode, promptText)`: logs `{kind:
"command", title: "Prompt (<how>)", command: how, text: prompt.trim()}` where
`how = [cli, model, effort, "<mode> mode"].filter(Boolean).join(" · ")`.

`logToolEvent(ctx, tools: ToolMap, event)`: only for `tool_call` /
`tool_call_update`. Merges `{title, input, output, content}` per tool id
(new values win, else previous). Logs when the status is `completed` or
`failed`, or on the first sight of a `tool_call`: `{id, kind: "tool_call",
title: title ?? "Tool call", command?, status, text?}`. Text: from `output`
(object: non-blank `stdout`, `stderr`, `output` trimmed-end, plus `exit <code>`
when `exitCode`/`exit_code` is a non-zero number; else `contentText`), else
from `content` (`contentText`: string as is; array → each item's
`content.text` or `text` or recursive, joined by newline; otherwise
pretty JSON or `String`). `text` included only when non-blank.

## Agent helpers

`llmProfileId(cli)`: always `"cursor"` (both `claude` and `cursor`).

`llmPromptText({system?, prompt})`: trimmed system (if non-empty) and
trimmed prompt joined by a blank line, plus trailing `"\n"`.

`inputUri(input)`: `flows://input/<name>` for run input, else
`flows://nodes/<from>/<name>`.

`llmContentBlocks(promptText, inputs, selfId?)`: `[{type:"text", text:
promptText}]`; inputs with non-blank text are "attached": one text block
`Inputs (attached below; they are not files in your working
directory):\n- <uri>: <label>\n...` with label `run input` / `feedback from
judge <from>` / `your previous result` (from === selfId) / `result of node
<from>`; then one `{type:"resource", uri, mimeType: ".md" → "text/markdown"
else "text/plain", text}` per attached input.

`createReply(logNarration?)`: accumulates `message_chunk` text in
`current`; on a `tool_call` with non-blank `current`, logs the trimmed
narration, moves it to `previous`, clears `current`. `final()` returns
trimmed `current` if non-blank, else trimmed `previous`. `logNarration(ctx)`
logs `{kind:"message", title:"Agent message", text}`.

Answers (`agent-answer.ts`, using contracts `declaredAnswers`,
`answerTypeHint`, `parseAnswerText`):

- `ANSWER_ERROR_FILE = "answer-error.txt"`.
- `nodeAnswerDecls(node)` = `node.answers ?? []`.
- `agentAnswerPrompt(decls)`: lines `## Answer`, blank, ``When you finish,
write `out/answer.json`: one JSON object with exactly these fields.``,
  blank, `- <name>: <typeHint>` per decl, blank; joined by `\n`.
- `agentFixPrompt(error)`: `## Fix the answer`, blank, ``Your
`out/answer.json` was rejected: <error.trim()>``, `Your earlier files are
kept in out/. Do not redo the work; write a corrected `out/answer.json`.`,
  blank.
- `readStepAnswer(docs, stepDir, decls)` = `parseAnswerText(decls,
text of <stepDir>/out/answer.json or "")`.
- `settleAnswer(docs, stepDir, decls, found)`: ok → `{ok:true, answer}`;
  if `<stepDir>/answer-error.txt` exists → `{ok:false, reason:"answer"}`;
  else write it with the error and return `{ok:false, fix:true, error}`.

`copyAgentMemories(docs, workflowDir, stepDir, memory?)`: removes every file
under `<stepDir>/input/memory/**`; for each memory path strip leading `./`
and `/`; a path containing `..` throws `memory path escapes workflow dir:
<rel>`; missing source throws `memory file missing: <rel>`; writes
`<stepDir>/input/memory/<basename>`.

## Built-in kinds

Frozen texts are read from `<runDir>/nodes/<id>/frozen/<name>`. Templates use
contracts `fillTemplate(text, ctx.answers)` (`{{name}}` placeholders with
known answers replaced).

### trigger (`kinds/trigger.ts`)

Settings `{ type: "manual", inputs?: unknown[] }`; ports in `[]`, out
`[text, file]`. Writes `text.md` = text of the input named `text.md` (or
`""`); each other input written to `files/<name>` (unchanged when already
prefixed `files/`), body `text ?? ""`. Then `done`.

### prompt (`kinds/prompt.ts`)

Settings `{ text?: string }`; ports in `[]`, out `[text]`. Writes
`text.md` = `fillTemplate(settings.text ?? frozen text.md ?? "")`; `done`.

### asset (`kinds/asset.ts`, `asset-items.ts`, `asset-resources.ts`)

Settings (`assetSettings`): `resources: {connection, entity, id}[]` (default
`[]`), `access: "read" | "propose"` (default `read`), `items?: string[]`,
`assetKind?: "image" | "markdown"`, `name?: string`. Ports in `[any]`, out
`[text, image, file]`. Order:

1. Has inputs ("produced"): write `name.trim() || "asset.md"` = body (the
   `text.md` input's text, else the first input with text, else `""`); done.
2. `items` non-empty: for each id read `library/<id>/item.yaml` with
   contracts `safeParseLibItemYaml`; failure → `failed exit "library item
missing: <id>"`. Files under `library/<id>/v<current>/**` (leading `/`
   stripped, skipping `*.version.yaml`) are written sorted to
   `files/<id>/<rel>`; text files (`.md|.markdown|.txt`, case-insensitive)
   contribute their trimmed-end bodies. `text.md` = for each item
   `"## <title> (v<current>)"` and texts joined by blank lines + `"\n"`, items
   joined by `"\n"`. done.
3. `resources` non-empty (`emitFixedResources`): read pins from
   `<runDir>/resources.json` (`{pins?: Pin[]}`, invalid JSON → `[]`; `Pin =
{connection, kind, entityId, revision, title?}`). For each resource:
   `seg = id` with `/`→`%2F`; base `<runDir>/resources/<conn>/<entity>/<seg>`;
   files under base or a single file at base; neither → `pinned folder
missing: <conn>/<entity>/<id>`; no pin with matching
   connection/kind/entityId → `resource not pinned: ...`. Single file →
   `files/<conn>/<entity>/<seg>`; folder → `files/<conn>/<entity>/<seg>/<suffix>`
   (`asset missing: <path>` when unreadable). `text.md` = lines `- <title ??
id> (<conn>/<entity>/<id>), revision <rev>` + `"\n"`. done.
4. `name` set (`emitFixedPath`): path = name normalized (`\`→`/`, leading
   `/` stripped); if it starts with `docket/`, `library/` or `workflows/` it
   is store-relative, else `<runDir>/<name>`. Missing → `asset missing:
<path>`. Output name = basename, under `files/` when `assetKind ===
"image"`. done.
5. Else `failed exit "asset has no library items to read"`.

### agent (`kinds/agent.ts`)

Settings: `cli: "claude" | "cursor"` (default `cursor`), `model?`, `effort?`,
`memory?: string[]`, `answers?` (contracts `answersSchema`), `prompt?`,
`system?`. Ports in/out `[text, file]`.

1. Prompt = `settings.prompt ?? frozen prompt.md ?? ""`; blank → `failed
exit "missing_prompt"`.
2. `workflowDir = runDir` minus trailing `/runs/<id>`;
   `copyAgentMemories(...)` (throws propagate).
3. Parts: `llmPromptText({system: filled system ?? frozen system.md, prompt:
filled prompt}).trimEnd()`; plus `agentAnswerPrompt(decls)` when the node
   declares answers; plus `agentFixPrompt(prior)` when
   `<stepDir>/answer-error.txt` exists. Blocks = `llmContentBlocks(parts
joined by "\n\n" + "\n", inputs, nodeId)`.
4. `ctx.agent.session({profileId: llmProfileId(cli), cwd: "", mode:
"agent", model?, effort?})`; `setMode("agent")` if supported; iterate
   `prompt(blocks, signal)` feeding `createReply(logNarration)`; `stop
cancelled` → `failed exit "cancelled"`; `stop refusal` → `failed exit
"refusal"`. Session always closed (`finally`).
5. With declared answers: `settleAnswer(readStepAnswer(...))` → `reason`
   → `failed answer`; `fix` → `failed answer "fix"` (collectExecute maps to
   `{fix: true}`, decide relaunches with `attempt + 1`, and the next attempt
   sees `answer-error.txt`); ok → write `text.md` = reply, `done {answer}`.
6. Otherwise write `text.md` = reply and `done`.

(The agent kind does not call `logToolEvent`/`logPrompt`.)

### llm (`kinds/llm.ts`)

Settings: `cli` (default `cursor`), `model?`, `effort?`, `planReview?:
"auto" | "ask"`, `prompt?`, `system?`. Ports in `[text, file]`, out
`[text]`. Same as agent steps 1, 3 (no answers, no memory), with
`logPrompt(ctx, settings, "agent", promptText)` before opening, mode
`"agent"`, and `logToolEvent` for each event. After the loop logs
`{kind:"message", title:"Agent reply", text}`, writes `text.md`, `done`.

### condition (`kinds/condition.ts`) — judge in rule mode

`CONDITION_BRANCHES = ["yes", "no"]`. Settings `cli` (default `cursor`),
`model?`, `effort?`, `prompt?`, `system?`. Prompt = `settings.prompt ??
frozen prompt.md ?? frozen rule.md`; blank → `failed exit
"missing_prompt"`. Like llm but mode `"ask"` (`logPrompt(..., "ask", ...)`,
`setMode("ask")`). Writes `text.md` = reply first, then
`conditionBranch(reply)`: first `[a-z]+` word (case-insensitive) lowercased,
`true`→`yes`, `false`→`no`, accepted only if in branches. Logs `{kind:
"message", title: "Judge answered <b>" | "Judge answer unclear", status:
ok|failed, text}`. No branch → `failed unclear` with `message = reply ||
"unclear_answer"`; else `done {branch}`.

### judge, check mode (`kinds/judge-check.ts`)

Registered as `judge`. Settings `{mode: "check", check: judgeCheckSchema}`.
`value = ctx.answers[check.field]`; `passed = evaluateCheck(check, value)`
(contracts). `test = "<field> <operator>[ <value>]"`, `title = "Check
passed|failed: <test>"`, `text = "<field> = <JSON value | (not set)>\nbranch:
yes|no"`. Logs a message entry, writes `text.md` = `title\n\ntext\n`, `done
{branch: passed ? "yes" : "no"}`. No model call.

### approval (`kinds/approval.ts`)

Settings `{question: string (min 1)}`. If `ctx.decision === "approved"` →
`done` (no outputs; downstream reads gated results by reference). Else
`question = fillTemplate(question)`; `await ctx.inbox.ask(question)`: in the
effect runner this throws `AskPending` (no `resolveAsk`), which
`collectExecute` turns into `{waiting: true, question}`; `approved` → done;
otherwise yield `waiting`. Flow on the actor: `launch_step` → waiting →
`approval_requested` + `post_inbox` → host answer `approved` →
`step_approved` → wake relaunches the same attempt → `done`.

### notify (`kinds/notify.ts`) — output target notify

Settings `{target: "notify", title?: string (trimmed 1..120), channel?:
"app" | "system", name?: string}`. Ports in `[text, file]`, out `[]`.
`title = settings.title ?? settings.name ?? node.name ?? graph.name ??
graph.id`; `text` = for each input named `text.md` with text: `## <from>\n\n
<text.trimEnd()>\n`, joined by `"\n"`, trimmed. Yields `notify {title, text,
channel?}` then `done {outputs: []}`. The runner posts exactly one notice.

### publish (`kinds/publish.ts`) — output target publish

Settings `{target: "publish", connection: string}`. Ports in `[text, file]`,
out `[file]`. Failure messages (all `reason: "exit"`):

1. No `ctx.publish` → `publish_port_missing`.
2. `policy(connection)` null or `read-only` → `publish_read_only`.
3. `decision === "approved"` → read `<stepDir>/changeset.json` (missing →
   `missing_changeset`, bad JSON → `bad_changeset`) and apply.
4. Else `diff({connectionId, runDir, nodeId, runId: ctx.runId ?? "run"})`;
   zero ops → `done {outputs: []}`. Write `changeset.json` (pretty JSON, not
   reported as an output). If `needsPersonGate(policy, changeSet)` (policy
   `approve-each-publish`, or any op `destructive`): ask `Publish <n>
change(s) to <connection>?` (singular when n = 1); not approved → `waiting`.
5. Apply: `apply({connectionId, changeSet, runDir})`; status ≠ `applied` →
   `failed exit <message>`; else `advanceBase?.(connection, runDir)`, write
   `result.json` (pretty `outcome.result`), yield `output_written` and `done
{outputs: [path]}`.
