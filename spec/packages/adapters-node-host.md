# `@workspace/adapters-node` — `src/host/` (Host composition, app db, library, runs)

Part of [adapters-node.md](adapters-node.md). `src/host/` holds the app
host leftovers moved here from the old engine (BL-214): the app SQLite db
(events + settings + notices), the `Host` class, path helpers, trust,
run folding helpers, the resource library, work copies, run input, and
legacy connection resolution. Connectors are in
[adapters-node-connectors.md](adapters-node-connectors.md).

Live runs are driven by the core FCP host (BL-197); `Host` provides the
shared `EventStore`, notices, trust, library and fold helpers.

## On-disk layout under `FLOWAPP_HOME`

| Path                                                  | Owner / format                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<home>/app.db`                                       | SQLite: `events`, `settings`, `notices`                                                                                                          |
| `<home>/engine.lock`                                  | engine lock (runtime doc)                                                                                                                        |
| `<home>/config.yaml`                                  | app config (`appConfigSchema`), optional                                                                                                         |
| `<home>/mcp-trust.json`                               | MCP allow list                                                                                                                                   |
| `<home>/blobs/{meta,data}/`                           | BlobStore                                                                                                                                        |
| `<home>/secrets/` (0700)                              | `secrets/<id>/cookies.json` (0600), `secrets/<id>/token`, `secrets/<id>/profile/` (Chrome profile)                                               |
| `<home>/connectors/<id>.yaml`                         | v2 connector files (parsed with `parseConnectorYaml`)                                                                                            |
| `<home>/connections/<id>/.publish-receipts/<fp>.json` | publish receipts (fake, github)                                                                                                                  |
| `<home>/library/<connection>/<kind>/<entity%2F>/`     | entity root: `<revision>/` dirs (+ `meta.json`), `current` symlink, `.clone/` (github mirror), `.pull-<uuid>/` and `.current-<uuid>` temporaries |
| `<home>/workflows/<workflowId>/`                      | workflow root; `input/`, `nodes/<id>/{prompt,system,user}.md`                                                                                    |
| `<home>/workflows/<wf>/runs/<runId>/`                 | run root (below)                                                                                                                                 |

Run root contents:

| Path                                                    | Meaning                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `input/`                                                | frozen run input + `inputs.json`                               |
| `resources.json`                                        | pins (`{ v: 1, pins, warnings }`)                              |
| `resources/<conn>/<kind>/<entity%2F>`                   | symlink to the pinned library revision                         |
| `resources/index.json`                                  | `{ v: 1, entries: pins }`                                      |
| `work/<conn>/<kind>/<entity%2F>/`                       | work copies                                                    |
| `publish-base/<conn>/`                                  | snapshot of last published work copy                           |
| `changes/<conn or taskId>/changeset.json`, `preview.md` | diff output                                                    |
| `nodes/<nodeId>/pass-<n>/attempt-<k>/`                  | step attempt dirs (`stdout.log`, `stderr.log`, exit code file) |
| `nodes/<nodeId>/frozen/`                                | node files frozen at run start                                 |

## paths.ts

| Function                                           | Result                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `resolveAppHome(override?)`                        | `override` if truthy, else `process.env.FLOWAPP_HOME` if truthy, else `~/.flowapp` |
| `resolveAppHomeRealpath(home)`                     | `mkdir -p home`, `realpathSync(home)`                                              |
| `appDbPath(home)`                                  | `<home>/app.db`                                                                    |
| `workflowDir(home, id)`                            | `<home>/workflows/<id>`                                                            |
| `runDir(workflowRoot, runId)`                      | `<workflowRoot>/runs/<runId>`                                                      |
| `connectionsDir(home)` / `connectionDir(home, id)` | `<home>/connections[/<id>]`                                                        |
| `secretsRoot(home)` / `secretsDir(home, id)`       | `<home>/secrets[/<id>]`                                                            |
| `libraryDir(home)`                                 | `<home>/library`                                                                   |
| `libraryEntityDir(home, conn, kind, entityId)`     | `<home>/library/<conn>/<kind>/<encodeEntityId(entityId)>`                          |
| `encodeEntityId(id)` / `decodeEntityId(seg)`       | `/` ↔ `%2F` (all occurrences)                                                      |

## config.ts

- `loadAppConfig(home)`: `<home>/config.yaml` missing → `{}`; else
  `yaml.parse` then `appConfigSchema.parse(raw ?? {})` (throws on invalid).
  Schema: `{ limits?: WorkflowLimits, library?: { maxBytes?: positive int }, agents?: { runtime: "spawn" | "acp" (default "spawn") } }`.
- `effectiveLimit(globalLimits, workflowLimits, key)`: minimum of the
  numeric values present at either level; none → `undefined`.

## event-log.ts — `class EventLog`

```ts
export class EventLog {
  constructor(dbPath: string)
  postNotice(n: NewNotice): boolean
  listNotices(limit?: number): NoticeList
  markNoticesRead(ids?: number[]): void
  getCliTrust(): CliTrustValue | null
  setCliTrust(value: CliTrustValue): void
  clearCliTrust(): void
  onAppend(listener: (stored: StoredEvent) => void): () => void
  asEventStore(): EventStore
  append(event: EngineEvent): number
  listByRun(runId: string): StoredEvent[]
  listRunIds(): string[]
  rebindWorkflowId(fromId: string, toId: string): void
  close(): void
}
```

- Constructor: `mkdir -p dirname(dbPath)`, `new DatabaseSync(dbPath)`,
  `openNodeEventStore(db)` (events DDL), `ensureSettingsTable`,
  `ensureNoticesTable`. All three tables share one file.
- In-memory `lastSeq: Map<runId, number>` caches `expectSeq`.
- `asEventStore()`: wraps the SQLite store; every method throws
  `Error("event log is closed")` after `close()`. `append` updates
  `lastSeq` (also on conflict) and notifies all `onAppend` listeners for
  each appended event, synchronously, in order.
- `append(event)`: closed check; `engineEventSchema.parse`; up to **8**
  attempts with `expectSeq = lastSeq.get(runId) ?? 0`, adopting the
  conflict's `lastSeq` and retrying; success updates the cache, notifies
  listeners, returns `seq`. After 8 conflicts:
  `Error("event append conflict for <runId>")`.
- `listByRun(runId)`: closed check; `store.read(runId)`; caches the last seq.
- `listRunIds()`: `SELECT run_id FROM events GROUP BY run_id ORDER BY MIN(seq) ASC` (first-appearance order; includes the pseudo run id `library`).
- `rebindWorkflowId(from, to)`: no-op if equal. Reads every row
  (`SELECT seq, payload FROM events`), in one transaction rewrites payloads
  where `event.workflowId === from` or `event.graph.id === from` (both set
  to `to`) via `UPDATE events SET payload = ? WHERE seq = ?`. Rollback and
  rethrow on error. `type`/`at` columns are unchanged. Payloads are parsed
  with plain `JSON.parse` (a corrupt row throws).
- `close()`: marks closed, closes the db.

## settings.ts

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

| Export                       | SQL / behaviour                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CLI_TRUST_KEY`              | `"cli_trust"`                                                                                                                             |
| `ensureSettingsTable(db)`    | DDL above                                                                                                                                 |
| `getSetting(db, key)`        | `SELECT value FROM settings WHERE key = ?` → value or `null`                                                                              |
| `setSetting(db, key, value)` | `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`                                   |
| `deleteSetting(db, key)`     | `DELETE FROM settings WHERE key = ?`                                                                                                      |
| `readCliTrust(db)`           | JSON of `cli_trust` parsed with `cliTrustValueSchema` (`{ homeRealpath: string min1, trustedAt: string min1 }`); missing/invalid → `null` |
| `writeCliTrust(db, v)`       | `setSetting("cli_trust", JSON.stringify(v))`                                                                                              |
| `clearCliTrust(db)`          | delete `cli_trust`                                                                                                                        |

Re-exports `type CliTrustValue`.

## notices.ts

```sql
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  at TEXT NOT NULL,
  read_at TEXT
);
```

`NewNotice = { key, title, text, runId, workflowId, nodeId, at, channel?: "app" | "system" }` (`channel` is not stored).

| Export                        | Behaviour                                                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensureNoticesTable(db)`      | DDL                                                                                                                                                                                                                          |
| `postNotice(db, n)`           | `INSERT OR IGNORE INTO notices (key, run_id, workflow_id, node_id, title, text, at) VALUES (...)`; returns `changes > 0` (a repeated key posts nothing)                                                                      |
| `listNotices(db, limit = 50)` | `SELECT * FROM notices ORDER BY id DESC LIMIT ?` plus `SELECT COUNT(*) AS n FROM notices WHERE read_at IS NULL`; returns `{ notices: [{ id, title, text, runId, workflowId, nodeId, at, read: read_at !== null }], unread }` |
| `markNoticesRead(db, ids?)`   | `at = now ISO`. No ids: `UPDATE notices SET read_at = ? WHERE read_at IS NULL`. With ids: per id `UPDATE notices SET read_at = ? WHERE id = ? AND read_at IS NULL`                                                           |

Notices are app state: deleting runs never touches them.

## host.ts — `class Host`

```ts
export type CreateHostOptions = { home?: string }
export class Host { readonly home: string; constructor(options?: CreateHostOptions); ... }
export function createHost(options?: CreateHostOptions): Host
```

Constructor:

1. `home = resolveAppHome(options.home)`.
2. `ensureBlobStore(home)` (module-level BlobStore at `<home>/blobs`).
3. `log = new EventLog(<home>/app.db)`.
4. `summaryCache = new RunSummaryCache(runId => this.fold(runId))`.
5. `log.onAppend`: refresh the summary of `event.runId`; on
   `run_succeeded` / `run_failed` / `run_cancelled` also
   `reconcileTrustMarker()`.
6. Rebuild the summary cache from `log.listRunIds()`.

| Method                                                      | Behaviour                                                                                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `homeRealpath()`                                            | `resolveAppHomeRealpath(home)`                                                                                                                                 |
| `listNotices()` / `postNotice(n)` / `markNoticesRead(ids?)` | delegate to `EventLog` (default limit 50)                                                                                                                      |
| `getCliTrust()`                                             | settings `cli_trust`                                                                                                                                           |
| `trustDecision()`                                           | `decideTrust({ homeRealpath, settings })` → `"always"` or `"none"`                                                                                             |
| `setAlwaysTrust()`                                          | store `{ homeRealpath, trustedAt: now }`; write Cursor trust marker for the home realpath                                                                      |
| `revokeAlwaysTrust()`                                       | clear setting; `reconcileTrustMarker()`                                                                                                                        |
| `reconcileTrustMarker()`                                    | see trust section                                                                                                                                              |
| `events(runId)`                                             | `listByRun(runId)` events                                                                                                                                      |
| `eventsWithSeq(runId)`                                      | stored events                                                                                                                                                  |
| `appendLibraryEvent(event)`                                 | `log.append(event)`                                                                                                                                            |
| `onEvent(listener)`                                         | `log.onAppend`                                                                                                                                                 |
| `eventStore()`                                              | `log.asEventStore()`                                                                                                                                           |
| `fold(runId)`                                               | `foldEvents(events(runId))`                                                                                                                                    |
| `listRuns()`                                                | every run id folded, non-null and not deleted (log order)                                                                                                      |
| `listRunsForWorkflow(id)`                                   | `listRuns()` filtered by `workflowId`, reversed (newest first)                                                                                                 |
| `listRunSummaries(opts?)` / `getRunSummary(id)`             | cache reads                                                                                                                                                    |
| `hasLiveRun(workflowId)`                                    | any run for it with status `queued`/`running`                                                                                                                  |
| `rebindWorkflowId(from, to)`                                | log rewrite + cache rebuild                                                                                                                                    |
| `markWorkflowRunsDeleted(workflowId)`                       | for each run of the workflow: live → throw `Error("cannot delete live run <id>")` (runs before it already marked); else append `run_deleted` `{ runId, at }`   |
| `pinNodeRun(input)`                                         | `runRemoval.pinNodeRun`                                                                                                                                        |
| `latestNodeRunId(workflowId, baseRunId?)`                   | `baseRunId` if given; else first (newest) run of the workflow with a `graph` and not deleted                                                                   |
| `cancelRun(runId)`                                          | fold; missing or deleted → `Error("unknown run <id>")`; status not `queued`/`running` → `Error("run <id> is not live")`; else `cancelNodeRun(log, runId)`      |
| `deleteRun(runId)`                                          | `runRemoval.deleteRun`                                                                                                                                         |
| `bootHousekeeping()`                                        | `finishPendingRemovals`, `reconcileTrustMarker`, rebuild summary cache                                                                                         |
| `liveRunIds()`                                              | ids of runs with live status                                                                                                                                   |
| `startLibraryRetention()`                                   | idempotent; run `sweepLibrary(home, { liveRunIds })` now, then every `LIBRARY_RETENTION_INTERVAL_MS` (1 h) via `setInterval(...).unref()`; promise not awaited |
| `close()`                                                   | clear the interval, close the log                                                                                                                              |

## blob-store.ts / process-runner.ts (host singletons)

- `getBlobStore()` → module store or throw `Error("BlobStore not configured")`;
  `setBlobStore(store)`; `ensureBlobStore(home)` → (re)creates
  `createNodeBlobStore({ root: <home>/blobs })`, stores and returns it.
- `getProcessRunner()` → module runner (initially `createNodeProcessRunner()`);
  `setProcessRunner(next)`.

## Trust (DES-019)

### trust-policy.ts

- `decideTrust({ homeRealpath, settings, runGrant? })`: `runGrant === "once"`
  → `"once"`; `settings?.homeRealpath === homeRealpath` → `"always"`; else
  `"none"`.
- `isAlwaysTrusted(homeRealpath, settings)` → decision is `"always"`.

### trust-marker.ts

- `runNeedsTrustMarker(state, homeRealpath, settings)`: false if deleted or
  status not `running`/`queued`; true if always-trusted; else
  `decideTrust({..., runGrant: state.trustGrant }) !== "none"`.
- `anyLiveRunNeedsMarker(runs, ...)`.
- `prepareTrustMarker(homePath, workflowDir?)`: write Cursor markers for
  `homePath` and, if given, `workflowDir`.
- `reconcileTrustMarker({ homeRealpath, settings, runs, workflowDirs? })`:
  if any live run needs a marker or always-trust is valid → write markers
  for the home realpath and each workflow dir; else remove markers for the
  home realpath and each dir.

### engine-trust.ts

- `applyStartTrustGrant(grant, homeRealpath, settings, setAlways)`:
  `"always"` → `setAlways({ homeRealpath, trustedAt: now })`; `"once"` →
  ok; otherwise ok only if always-trusted, else `Error("trust_required")`.
- `reconcileEngineTrustMarker({ home, homeRealpath, settings, runs })`:
  workflow dirs (deduped) = `workflowDir(home, r.workflowId)` for runs that
  are `running`/`queued` and either have `trustGrant === "once"` or the
  home is always-trusted; then `reconcileTrustMarker`.
- `trustDecisionFor(homeRealpath, settings)` = `decideTrust` without grant.
- Re-exports `prepareTrustMarker`.

### trust.ts (Host helpers over `EventLog`)

`getCliTrust(log)`, `trustDecision(log, home)`, `setAlwaysTrust(log, home)`
(store + `prepareTrustMarker(realpath)`), `revokeAlwaysTrust(log, home)`
(clear + reconcile), `reconcileTrustMarker(log, home)`
(`reconcileEngineTrustMarker` with `listLoggedRuns(log)`).

### cursor-trust.ts — Cursor workspace trust markers

Marker file: `<projectsDir>/<slug>/.workspace-trusted`, content
`JSON.stringify({ trustedAt, workspacePath }, null, 2) + "\n"`.

| Export                                     | Behaviour                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type CursorTrustMarker`                   | `{ trustedAt: string; workspacePath: string }`                                                                                                                                              |
| `sanitizeCursorProjectPath(p)`             | strip leading `/`s, replace every `/` with `-`                                                                                                                                              |
| `resolveCursorProjectsDir(override?)`      | override, else `FLOWAPP_CURSOR_PROJECTS`, else `~/.cursor/projects`                                                                                                                         |
| `cursorPathVariants(p)`                    | set of: `p`; if it exists its realpath and, when the realpath starts with `/private/`, the realpath without `/private`; if `p` starts with `/var/`, `/private` + `p`. Insertion order kept. |
| `cursorTrustMarkerPath(p, projectsDir?)`   | path above                                                                                                                                                                                  |
| `writeCursorTrustMarker(p, projectsDir?)`  | one `trustedAt` (now) for all variants; `mkdir -p` and write each; returns written paths                                                                                                    |
| `removeCursorTrustMarker(p, projectsDir?)` | `rm -f` each existing variant marker; returns whether any removed                                                                                                                           |
| `readCursorTrustMarker(p, projectsDir?)`   | first variant whose file parses with string `trustedAt` and `workspacePath`; else `null`                                                                                                    |
| `pathComponentCount(abs)`                  | number of non-empty `/` segments                                                                                                                                                            |

## Runs: fold, summary, cancel, removal

### nodes/fold-steps.ts

Types: `StepStatus = "pending"|"running"|"waiting"|"done"|"failed"|"skipped"|"cancelled"`;
`StepFailReason = "exit"|"timeout"|"unclear"|"answer"|"loop_limit"|"conflict"|"rejected"`;
`AttemptInfo { attempt, startedAt, pid?, timeout?, model?, effort?, modelSource?, open, exitCode?, reason?, interrupted?, endedAt? }`;
`StepState { nodeId, pass, status, attempts, outputs?, branch?, answer?, failReason?, question?, decision?: "approved"|"rejected", current?: AttemptInfo, reused?, seq }`;
`StepsState { steps: Record<nodeId, StepState[]>, ended: boolean }`.

`isOpenStep(s)`: status in `pending|running|waiting`. `latestStep(state, nodeId)`: last pass.

`foldSteps(events)`: `seq` = 1-based index in the given array. A step is
created on demand (`status: "pending"`, `attempts: 0`) and the node's list
kept sorted by pass.

| Event                                            | Effect                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `step_started`                                   | ensure; `running`; seq                                                                                                                |
| `attempt_started` (needs `nodeId`; `pass ?? 1`)  | ensure; `attempts = max(attempts, attempt)`; `running`; `current = { attempt, startedAt: at, open: true }`                            |
| `attempt_launched`                               | if current attempt matches: set `pid`, `timeout`, `model`, `effort`, `modelSource`                                                    |
| `attempt_finished` / `attempt_interrupted`       | if current matches: `open = false`, `endedAt`; finished sets `exitCode`, `reason`; interrupted sets `interrupted = true`              |
| `approval_requested`                             | step by `nodeId`+`pass ?? 1`, else latest step of `taskId`; if `running` → `waiting`, set `question` if defined                       |
| `step_approved`                                  | if `waiting` → `running`, `decision = "approved"`                                                                                     |
| `step_done`                                      | ensure; `done`; `outputs`, `branch`, `answer`, `reused`; seq                                                                          |
| `step_failed`                                    | ensure; `failed`; `failReason = reason`; seq                                                                                          |
| `step_skipped`                                   | ensure; `skipped`; `reused`; seq                                                                                                      |
| `step_rejected` / `step_cancelled`               | ensure; `cancelled`; rejected sets `decision = "rejected"`; seq                                                                       |
| `step_retry_requested`                           | existing step only: `pending`, clear `failReason, outputs, branch, answer, current, question, decision, reused`; seq; `ended = false` |
| `run_succeeded` / `run_failed` / `run_cancelled` | `ended = true`                                                                                                                        |

### nodes/run-state.ts

`RunState { runId, workflowId, status: RunStatus, graph: Workflow, tasks: Record<id, TaskState>, steps: StepsState, sandboxed, trustGrant?: "once", startedAt?, finishedAt?, itemKey?, cardId?, source?: "manual", inputHash?, inputFiles?, cancelRequested?, deleted? }`;
`TaskState { id, status: TaskStatus, attempts: AttemptState[] }`;
`AttemptState { attempt, pid?, exitCode?, interrupted?, startedAt?, timeout?, reason?, model?, effort?, modelSource? }`.

- `isLiveRunStatus(s)`: `queued` or `running`.
- `stepTaskStatus(s)`: `pending→pending, running→running, waiting→awaiting_approval, done→succeeded, failed→failed, skipped→skipped, cancelled→cancelled`.
- `foldEvents(events)` → `null` without `run_started`:
  - `run_started`: new state (later `run_started` replaces it), status
    `queued` if `event.queued === true` else `running`; `sandboxed: true`;
    copies `trustGrant`, `startedAt = at`, `source`, `itemKey`, `cardId`,
    `inputHash`, `inputFiles = event.files`.
  - `run_activated`: `queued → running`.
  - `attempt_launched` with `sandboxed !== true` → `sandboxed = false`.
  - `cancel_requested` → `cancelRequested = true`.
  - `run_cancelled|run_succeeded|run_failed` → status = type without
    `run_` prefix; `finishedAt = at`.
  - `run_deleted` → `deleted = true`.
  - `step_retry_requested` on a `failed`/`succeeded` run → `running`,
    `finishedAt = undefined`.
  - Then `steps = foldSteps(events)` and for each graph node
    `tasks[id] = { id, status: mapped latest step status or "pending", attempts: [current attempt] or [] }`.

### nodes/step-paths.ts

`stepDir(runRoot, nodeId, pass)` = `<runRoot>/nodes/<nodeId>/pass-<pass>`;
`attemptRootOf(stepDir, attempt)` = `<stepDir>/attempt-<attempt>`;
`frozenDir(runRoot, nodeId)` = `<runRoot>/nodes/<nodeId>/frozen`;
`relOut(...parts)` = `parts.join("/")`.

### nodes/cancel.ts

- `cancelRequested(events)`: any `cancel_requested`.
- `finishNodeCancel(log, runId)`: if steps ended → return. `rejected` = any
  `step_rejected`. First `killProcessGroup(pid)` (SIGTERM) for every step
  whose current attempt is open with a pid; then append
  `step_cancelled { nodeId, pass }` for every open step (in node insertion
  order, pass order); then `run_cancelled` with `reason: "rejected"` when
  rejected. All `at` = now. Idempotent.
- `cancelNodeRun(log, runId)`: ended → return; append `cancel_requested`
  unless present; `finishNodeCancel`.

### nodes/publish-assert.ts, nodes/template-assert.ts

- `assertNodePublishValid(home, graph)`: for each `output` node with
  `target === "publish"`: no `connection` → `Error("publish node <id> is missing a connection")`;
  `requireConnection` (unknown → `Error("unknown connection <id>")`);
  policy `read-only` → `Error("publish node <id> cannot use read-only connection <conn>")`.
- `assertNodeTemplatesValid(home, graph)`: collect existing
  `<workflowDir>/nodes/<nodeId>/{prompt.md,system.md,user.md}` as
  `{ nodeId, label: file, text }`; `templateProblems(nodes, edges, texts)`
  (contracts); first problem → `Error("node <nodeId> <label>: <message>")`.

`nodes/index.ts` re-exports all six node modules (barrel; not used by
`host/index.ts`, which imports `run-state` and `step-paths` directly).

### log-runs.ts

`foldLoggedRun(log, runId)`; `listLoggedRuns(log)` = all run ids folded,
skipping null and deleted.

### run-summary.ts

`summarizeRun(state)` → `RunSummary | null` (deleted → null):

- `needsYou`: for each graph node whose task status is `awaiting_approval`:
  `{ taskId, question? (latest step's question), connectionId? (when node is output/publish with a connection) }`.
- `taskCounts = { done: tasks in succeeded|failed|skipped|cancelled, total: nodes.length }` (missing task counts as pending).
- `firstFailedTaskId`: first node (graph order) with status `failed`.
- Fields: `id, workflowId, workflowName: graph.id, status, needsYou, taskCounts, firstFailedTaskId?, itemKey?, cardId?, startedAt: startedAt ?? new Date(0).toISOString(), finishedAt?` (`finishedAt` only when not live and defined).

`ListRunSummariesOptions = { status?, workflowId?, cardId?, limit? (default 100) }`.

`class RunSummaryCache(fold)`: `rebuild(ids)` (clear + refresh each),
`refresh(id)` (fold + summarize; null removes), `get(id)`, `list(opts)`:
filter by each provided option, sort by `startedAt` desc then `id` desc
(string compare), slice to limit.

### delete-run.ts, run-removal.ts

- `deleteRunFiles(runRoot, append, state)`: already deleted →
  `finishRunRemoval`; live → `Error("cannot delete live run <id>")`; else
  append `run_deleted { runId, at: now }` then `finishRunRemoval`.
- `finishRunRemoval(runRoot)`: missing → no-op; `removeWorkCopies` then
  `rm -rf runRoot`.
- `PinNodeRunInput = { graph: Workflow; runId; cardId?; pinFromRunId?; refreshPins? }`.
- `markWorkflowRunsDeleted(log, runs)` (see Host).
- `pinNodeRun(log, home, input)`: `assertNodePublishValid`,
  `assertNodeTemplatesValid`; no `asset` node → `undefined`; else
  `mkdir -p <workflowDir(graph.id)>/runs/<runId>` and
  `materializeNodeRunResources({ home, graph, runRoot, runId, cardLinks: [], pinFromRunRoot, refreshPins })`
  where `pinFromRunRoot` is the run dir of `pinFromRunId` if that run folds.
  `cardId` is ignored.
- `deleteRun(log, home, runId)`: unknown → `Error("unknown run <id>")`; else
  `deleteRunFiles(<workflowDir>/runs/<id>, log.append, state)`.
- `finishPendingRemovals(log, home)`: for every deleted run, `finishRunRemoval`.

## Library (DES-026)

### library-paths.ts

- Refresh windows: `15m` = 900 000 ms, `1h` = 3 600 000 ms, `1d` = 86 400 000 ms; `never`.
- `type RevisionMeta = { pulledAt, title, connection, kind, entityId }`
  stored as `<revision>/meta.json` (pretty JSON, 2 spaces).
- `isFresh(pulledAt, rule)`: no `pulledAt` → false; `never` → true; age
  (`Date.now() - Date.parse`) NaN → false; else `age <= window`.
- `revisionMetaPath(dir)`, `readRevisionMeta(dir)` (missing/bad → undefined).
- `currentRevision(home, conn, kind, entityId)`: `readlink` of
  `<entityRoot>/current` (relative revision name) or undefined.
- `entityIdSegment(id)`: `/` → `%2F`.

### library.ts

- `LIBRARY_EVENT_RUN_ID = "library"` (pseudo run id for manual pulls).
- `ScopeEntity = { kind, entityId, title }`; `PullEntityResult = { revision, title, pulledAt, fromCache }`.
- `resolveScopeEntity(connection)`: connector must be registered
  (`Error("unknown connector <id>")`); `kind = describe().entityKinds[0]`
  (none → `Error("connector <id> has no entity kinds")`); entity id = the
  non-empty scope values of `describe().scopeFields` in order, skipping
  `ambient, failPull, signedOut, remote, host, command, url, domain`,
  joined with `/` (none → `Error("connection <id> has no scope entity id")`);
  `title = connection.name`.
- `pullEntity({ home, connection, kind, entityId, title?, force? })`:
  1. If `current` exists, not `force`, and its meta is fresh per
     `connection.refresh` → return it with `fromCache: true`.
  2. Connector lookup; `await connector.check(connection, home)`; not ok →
     `Error(check.message)`.
  3. `assertLibraryHasSpace(home)`.
  4. `mkdir -p entityRoot`; staging `<entityRoot>/.pull-<uuid>`;
     `connector.pull({ connection, entityKind: kind, entityId, entityRoot, destDir: staging, home })`.
  5. `revision = pulled?.revision?.trim() || randomUUID()`; rename staging
     to `<entityRoot>/<revision>` unless it already exists (then delete
     staging; existing revision dir kept).
  6. Write `meta.json` `{ pulledAt: now, title, connection, kind, entityId }`
     (overwrites when the revision existed).
  7. Atomic `current` swap: `symlink(revision, <entityRoot>/.current-<uuid>)`
     then `rename` over `current` (relative link target).
  8. On error: `rm -rf` staging, rethrow.
- `linkRunResources(home, runRoot, resources)`: `rm -rf <runRoot>/resources`,
  recreate; for each pin: target = library revision dir (missing →
  `Error("pinned revision missing: <conn>/<kind>/<entityId>@<rev>")`);
  symlink `<runRoot>/resources/<conn>/<kind>/<entity%2F>` → absolute target.
  Write `resources/index.json` = `{ v: 1, entries: pins }` and
  `<runRoot>/resources.json` = resources (both pretty, 2 spaces).
- `readResourcesJson(runRoot)`: parse with `resourcesJsonSchema`
  (`{ v: 1, pins: [{ connection, kind, entityId, revision, title }], warnings: string[] default [] }`);
  missing/invalid → undefined.

### library-run-targets.ts, library-run.ts

- `PullTarget = { connection: Connection; kind; entityId; title }`.
- `collectNodePullTargets(home, graph, links)`: no `asset` nodes → `[]`.
  Each asset node's `resources[]` (`{ connection, entity, id }`) then each
  link (`{ connection, kind, entityId }`), deduped by
  `connection\0kind\0entityId`; connection via `requireConnection`;
  `title = conn.name`.
- `pullOneTarget(home, runId, at, target, force)`: `pullEntity`; pin
  `{ connection, kind, entityId, revision, title }`; when not from cache
  also an event `library_pulled { runId, at, connection, kind, entityId, revision, impact: "read" }`.
  On failure: no current revision → throw
  `Error("library pull failed for <c>/<k>/<e>: <msg>", { cause })`; else pin
  the current revision (title from its meta or target) with warning
  `"pull failed for <c>/<k>/<e>: <msg>; using revision <rev>"`.
- `materializeNodeRunResources({ home, graph, runRoot, runId, cardLinks?, pinFromRunRoot?, refreshPins? })` → `MaterializeResourcesResult = { resources, pulledEvents }`:
  - No targets → link empty `{ v: 1, pins: [], warnings: [] }`.
  - `pinFromRunRoot` and not `refreshPins`: reuse the prior run's pins
    (`warnings: []`) when the prior has ≥1 pin and covers every target
    (match on connection id, kind, entityId); no events.
  - Else pull each target in order (single `at` for the batch, `force =
refreshPins === true`), collect pins/events/warnings, link.
- `pullNow({ home, connectionId, kind?, entityId? })`: `requireConnection`,
  `resolveScopeEntity` for defaults, `pullEntity(force: true, title: scope.title)`;
  returns `result { connection, kind, entityId, revision, title, pulledAt }`
  and `event library_pulled` with `runId: "library"`, `impact: "read"`.

### library-list.ts

`listLibrary(home)` → `{ entities, usage }`. Walks
`library/<conn>/<kind>/<entity>/` directories (decoding entity ids). Per
entity: `current` = readlink of `current` if it exists; revisions = child
directories not starting with `.` that have readable meta:
`{ revision, pulledAt, title, current: name === current, pinningRunIds }`,
sorted by `pulledAt` desc. Entity row:
`{ connection, kind, entityId, title: currentMeta.title ?? conn.name ?? connectionId, refresh: conn.refresh ?? "never", pulledAt: currentMeta.pulledAt, fresh, revisions }`
(`conn` via `findConnection`, may be undefined). Entities sorted by
`conn/kind/entityId`.

### library-pins.ts

- `PinKey`; `pinKey(p)` = `connection\0kind\0entityId\0revision`.
- `collectAllPins(home)`: every `workflows/*/runs/*/resources.json` pins.
- `listPinningRuns(home, conn, kind, entityId, revision)`: run dir names
  whose resources pin exactly that revision, sorted.
- `pinnedRevisionKeys(home)`: set of `pinKey` for all pins.

### library-usage.ts

- `class LibraryCapError extends Error` with `code = "library_cap"`,
  `usedBytes`, `maxBytes`, `name = "LibraryCapError"`, message
  `Library is at the size cap (<used> of <max>). Clear unused revisions or raise library.maxBytes in config.yaml. Pinned revisions were not deleted.`
- `libraryMaxBytes(home)`: `config.yaml` `library.maxBytes` or
  `DEFAULT_LIBRARY_MAX_BYTES` (5 GiB = 5·1024³).
- `formatBytes(n)`: `< 1024` → `"<n> B"`; else divide by 1024 until `< 1024`
  (units KB, MB, GB, TB); KB with 0 decimals, others 1 decimal
  (`"1 KB"`, `"1.5 MB"`).
- `pathByteSize(root)`: recursive sum of `statSync` sizes (follows
  symlinks); missing → 0.
- `libraryUsage(home)` → `{ usedBytes: size of <home>/library, maxBytes }`.
- `assertLibraryHasSpace(home)`: `usedBytes >= maxBytes` → throw
  `LibraryCapError`.

### library-retention.ts

- `LIBRARY_RETENTION_MS = 7 days` (604 800 000); `LIBRARY_RETENTION_INTERVAL_MS = 1 hour`.
- `SweepOptions = { now?, maxAgeMs?, liveRunIds? }`; `SweepResult = { removed: string[], gcRepos: string[] }`.
- `sweepLibrary(home, opts)`: for each entity, for each revision dir (not
  starting with `.`) that is not `current`, not pinned by any run, with
  parseable meta and `now - pulledAt >= maxAgeMs` → `rm -rf`, record
  `"<conn>/<kind>/<entityId>@<rev>"`. Revisions without meta or with an
  unparseable date are kept. Then `pruneIdleClonesAsync(home, liveRunIds)`.
- `clearEntityRevisions(home, conn, kind, entityId)` →
  `LibraryClearResult { connection, kind, entityId, removed: rev[] }`: any
  age; skips current and pinned.
- `connectionHasLiveWorkCopy(home, conn, liveRunIds: Set)`: any live run
  dir under `workflows/*/runs/<id>/work/<conn>` exists.
- `pruneIdleClonesAsync(home, liveRunIds)`: for each entity with a
  `.clone` dir and no live work copy for its connection:
  `git -C <clone> config gc.auto 0` then `git -C <clone> gc --prune=now`
  (errors swallowed); returns the processed clone dirs.

## Work copies (work-copy.ts)

| Export                                                                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workConnectionDir(runRoot, conn)`                                      | `<runRoot>/work/<conn>`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `workEntityDir(runRoot, conn, kind, entityId)`                          | `<work>/<conn>/<kind>/<entity%2F>`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ensureLibraryGcAutoOff(repo)`                                          | if `<repo>/.git` exists: `git -C <repo> config gc.auto 0` (stdio ignored)                                                                                                                                                                                                                                                                                                                                                                                                      |
| `copyPinnedEntity(src, dest)`                                           | `dest` exists → no-op; `mkdir -p dirname`; git repo (`src/.git`) → gc.auto off on `src`, `git clone --shared <src> <dest>`; else `cp -cR <src> <dest>` (APFS clone), fallback `cpSync` recursive                                                                                                                                                                                                                                                                               |
| `ensureWorkCopiesFor(runRoot, connectionIds)`                           | no `resources.json` or no ids → return; for each pin of each id whose work dir is missing: source = realpath of `resources/<conn>/<kind>/<entity%2F>` (missing → `Error("missing resource pin <c>/<k>/<e>")`; realpath failure → readlink), `copyPinnedEntity`                                                                                                                                                                                                                 |
| `previewFromChangeSet(cs)`                                              | no ops: `# Changes for <conn>\n\nNo changes.\n`; else lines `# Changes for <conn>`, ``, `Base: <base>`, ``, then per op ``- **<op>** `<target>`<" (destructive)" if destructive>: <summary>``, final empty line, joined with `\n`                                                                                                                                                                                                                                              |
| `changesDir(runRoot, conn)`                                             | `<runRoot>/changes/<conn>`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `publishChangesDir(runRoot, taskId)`                                    | `<runRoot>/changes/<taskId>`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `workPublishBaseDir(runRoot, conn)`                                     | `<runRoot>/publish-base/<conn>`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `advanceWorkCopyBase(runRoot, conn)`                                    | work dir missing → no-op; `rm -rf` base; `mkdir -p` parent; `cp -cR <work>/<conn> <base>` (fallback `cpSync`)                                                                                                                                                                                                                                                                                                                                                                  |
| `diffWorkCopy({ home, runRoot, connectionId, publishTaskId?, runId? })` | `runId` default `basename(runRoot)`; connection + connector (unknown → `Error("unknown connector <id>")`); no work dir → `{ v: 1, connection, base: "none", ops: [] }` (nothing written); base dir = `publish-base/<conn>` if present else `resources/<conn>`; `connector.diff({ connection, workCopyDir, baseDir, runId, publishTaskId })`; writes `changeset.json` (pretty) and `preview.md` into `changes/<taskId>` or `changes/<conn>`; returns `{ changeSet, previewMd }` |
| `listWorkConnections(runRoot)`                                          | sorted dir names under `work/`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `recordUnpublishedLocalEffects({ home, runRoot, runId, append })`       | for each work connection: diff; if ops > 0 append `work_copy_changed { runId, connection, impact: "local", opCount, destructive: any op destructive, at }`; diff errors skipped                                                                                                                                                                                                                                                                                                |
| `removeWorkCopies(runRoot)`                                             | `rm -rf <runRoot>/work`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Run input (run-input.ts, source-manual.ts, item-key.ts)

- `runInputDir(runRoot)` = `<runRoot>/input`.
- `materializeRunInput(workflowRoot, runRoot, item: ManualItem, cardId?)` →
  `{ itemKey, inputHash, files, cardId? }`:
  1. `mkdir -p input`; copy `<workflowRoot>/input` recursively if present.
  2. `manualSource.materialize(item, dest)`.
  3. `itemKey = cardId ? cardItemKey(cardId) : manualItemKey(fields)`.
  4. Write `input/inputs.json` (pretty):
     `{ source: "manual", fields, itemKey, itemKeyVersion: 1, cardId? }`.
  5. `files` = all files under `input/` (relative, sorted, includes
     `inputs.json`); `inputHash` = SHA-256 hex of
     `JSON.stringify([{ path, sha256 }...])` where each `sha256` is of the
     file bytes.
- `ManualItem = { decls: WorkflowInputDecl[]; values: Record<string, string | undefined>; files: ManualFilePart[] }`,
  `ManualFilePart = { field, basename, data: Buffer }`.
- `manualSource = { id: "manual", materialize(item, destDir) }`:
  - `resolved = applyInputDefaults(decls, values)` (contracts).
  - For each decl: `file` → first part with `field === name` (skip if
    none); write `<dest>/<name>/<basename(part.basename)>`; key field
    `{ name, type: "file", sha256 }`; inputs field `{ type: "file", path: "<name>/<file>" }`.
    `text`/`markdown` → skip undefined; `text = normalizeInputText(type, raw)`;
    write `<dest>/<name>.md` (markdown) or `<name>.txt`; key field
    `{ name, type, text }`; inputs field `{ type, value: text }`.
  - Extra parts: skip parts whose field is a declared file field; when
    there are declarations, only parts with field `attach` continue; write
    `<dest>/attach/<basename>`; key `{ name: "attach/<file>", type: "file", sha256 }`.
  - Returns `{ fields: keyFields, inputsJson: { source: "manual", fields } }`.
- `manualItemKey(fields)` = SHA-256 hex of `canonicalManualItemPayload(fields)`;
  `cardItemKey(cardId)` = SHA-256 hex of `canonicalCardKeyPayload(cardId)`
  (both canonical payload functions in contracts).

## Connections (legacy shape)

### connection-model.ts

```ts
connectionSchema = z.strictObject({
  id: connectionIdSchema, // slug
  connector: z.string().min(1),
  name: z.string().min(1),
  scope: z.record(z.string(), z.string()).default({}),
  signIn: signInMethodSchema, // "cli" | "mcp" | "cookies"
  refresh: refreshRuleSchema, // "15m" | "1h" | "1d" | "never"
  policy: publishPolicySchema.default("read-only"), // read-only | approve-each-publish | trust-agent-review
  serial: z.boolean().default(false),
})
type ResourceLink = {
  connection: string
  kind: string
  entityId: string
  title?: string
}
```

### connection-resolve.ts

- `ConnectionLookup = (home, id) => Connection | undefined`; module
  override via `setConnectionLookup(fn)` / `resetConnectionLookup()`.
- `connectionFromConnectorFile(file)` → `{ id, connector: adapterId, name, scope, signIn, refresh: "never", policy, serial: false }`:
  - `adapterId`: `providerId` if registered; else `id` if registered; else `providerId ?? id`.
  - `scope`: `{ command: how }` for `transport === "cli"`, else `{ url: how }`.
  - `signIn`: auth `cookies` → `cookies`; `cli-login` → `cli`; anything else → `mcp`.
  - `policy`: `approve-each-publish` if any capability has `write && allowed`, else `read-only`.
- `findConnection(home, id)`: override if set; else read
  `<home>/connectors/<id>.yaml` with `parseConnectorYaml` (missing or parse
  error → undefined).
- `requireConnection(home, id)`: undefined → `Error("unknown connection <id>")`.

### test-connections.ts

In-memory `Map<home, Map<id, Connection>>`.
`installTestConnectionStore()` clears it and installs it as the lookup;
`resetTestConnectionStore()` clears and resets the lookup;
`registerTestConnection(home, input)` validates (zod message on failure),
requires a registered connector (`Error("unknown connector <id>")`), stores
and returns; `updateTestConnection(home, conn)` replaces if the home map
exists.

### secrets.ts (cookies)

- `type StoredCookie = { name; value; domain; path; expires?: number; httpOnly?; secure?; sameSite?: "Strict"|"Lax"|"None" }`.
- `cookiesPath(home, id)` = `<home>/secrets/<id>/cookies.json`; secret key
  `<id>/cookies.json` via `createNodeSecretStore({ root: <home>/secrets })`.
- `profileDir(home, id)` = `<home>/secrets/<id>/profile`.
- `ensureSecretsDir(home, id?)`: `mkdir -p` + `chmod 0700` the root and the
  connection dir if given; returns the deepest dir.
- Cookie parsing: array required; every entry needs non-empty `name`,
  string `value`, non-empty `domain` (otherwise the whole list is invalid);
  `path` defaults to `/`; optional fields kept only with the right types.
- `readCookies(home, id)`: missing / bad JSON / invalid → undefined.
- `isSignedIn(home, id)`: cookies parse and non-empty.
- `writeCookies(home, id, cookies)`: invalid → `Error("invalid cookies")`;
  `ensureSecretsDir`; store `JSON.stringify(parsed, null, 2) + "\n"` (0600).
- `removeSignIn(home, id)`: delete the key, then `rm -rf <home>/secrets/<id>`
  (library untouched).

## mcp/client.ts — line-delimited MCP tool client (connectors)

```ts
export type McpClient = {
  callTool(name, args): Promise<unknown>
  close(): Promise<void>
}
export type McpConnectInput = { command?: string; url?: string }
export async function connectMcpStdio(command: string): Promise<McpClient>
export async function connectMcpUrl(url: string): Promise<McpClient>
export async function connectMcp(input: McpConnectInput): Promise<McpClient>
```

- No `initialize` handshake: only `tools/call` requests
  (`{ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments } }`, ids from 1).
- Stdio: `spawn(command, { shell: true, stdio: pipe×3 })` (not sandboxed,
  not via ProcessRunner). Missing pipes → kill and
  `Error("mcp server failed to start")`. Lines from stdout: blank ignored;
  messages without a numeric id ignored; a matching pending request
  resolves with `result`, or rejects with `error.message`, or
  `Error("mcp response missing result")`. Unparseable line rejects all
  pending. Child exit rejects all pending with
  `Error("mcp server exited with code <code ?? "?">")`. Write errors reject
  that call. `close()` closes readline and kills the child (SIGTERM).
- URL: `POST` with `content-type: application/json`; non-2xx →
  `Error("mcp http <status>")`; body text parsed; id mismatch →
  `Error("mcp response id mismatch: expected <id>, got <id>")`.
- `connectMcp`: trimmed `command` wins, else trimmed `url`, else
  `Error("connection scope needs command or url for MCP")`.

## mcp/trust.ts

Same file and semantics as top-level `mcp-trust.ts` (separate module-level
once-set) plus:

- `mcpServerKeyFromScope(scope)`: trimmed `scope.command`, else trimmed
  `scope.url`, else `null`.
- `readMcpTrustValue(home)` (exported here).
- `isMcpServerAllowed(home, key)`: empty → false; in once-set → true; else
  present in the file.

## index.ts (host barrel)

Exports (re-exported in part from the package root, see
[adapters-node.md](adapters-node.md#indexts-exports)):

- host.ts: `createHost`, `Host`, `type CreateHostOptions`
- blob-store.ts: `ensureBlobStore`, `getBlobStore`, `setBlobStore`
- event-log.ts: `EventLog`, `type StoredEvent`
- paths.ts: `resolveAppHome`, `resolveAppHomeRealpath`, `appDbPath`, `workflowDir`, `runDir`, `connectionsDir`, `connectionDir`, `secretsRoot`, `secretsDir`, `libraryDir`, `libraryEntityDir`, `encodeEntityId`, `decodeEntityId`
- secrets.ts: `cookiesPath`, `profileDir`, `ensureSecretsDir`, `readCookies`, `writeCookies`, `isSignedIn`, `removeSignIn`, `type StoredCookie`
- library.ts: `LIBRARY_EVENT_RUN_ID`, `resolveScopeEntity`, `pullEntity`, `linkRunResources`, `readResourcesJson`, `type ScopeEntity`, `type PullEntityResult`
- library-run.ts: `materializeNodeRunResources`, `pullNow`, `type MaterializeResourcesResult`
- library-list.ts: `listLibrary`; library-paths.ts: `isFresh`, `currentRevision`, `readRevisionMeta`
- library-retention.ts: `LIBRARY_RETENTION_MS`, `LIBRARY_RETENTION_INTERVAL_MS`, `sweepLibrary`, `clearEntityRevisions`, `connectionHasLiveWorkCopy`, `pruneIdleClonesAsync`
- library-usage.ts: `LibraryCapError`, `libraryMaxBytes`, `libraryUsage`, `assertLibraryHasSpace`, `formatBytes`, `pathByteSize`
- library-pins.ts: `listPinningRuns`, `pinnedRevisionKeys`
- connection-model.ts: `connectionSchema`, `type Connection`, `type ConnectionInput`, `type ResourceLink`
- connection-resolve.ts: `findConnection`, `requireConnection`, `setConnectionLookup`, `resetConnectionLookup`, `connectionFromConnectorFile`, `type ConnectionLookup`
- test-connections.ts: `installTestConnectionStore`, `resetTestConnectionStore`, `registerTestConnection`, `updateTestConnection`
- connectors/index.ts: `registerConnector`, `unregisterConnector`, `getConnector`, `listConnectors`, `clearConnectors`, `registerBuiltinConnectors`, `fakeConnector`, `githubConnector`, `createGithubConnector`, `confluenceConnector`, `createConfluenceConnector`, `MCP_TRUST_REQUIRED`, `rallyConnector`, `createRallyConnector`, `type Connector`, `type ConnectorChangeSet`, `type ConnectorPublishResult`
- work-copy.ts: `copyPinnedEntity`, `workConnectionDir`, `workEntityDir`, `diffWorkCopy`, `recordUnpublishedLocalEffects`, `listWorkConnections`, `removeWorkCopies`, `ensureLibraryGcAutoOff`, `ensureWorkCopiesFor`, `advanceWorkCopyBase`, `publishChangesDir`, `workPublishBaseDir`
- run-input.ts: `runInputDir`, `materializeRunInput`, `type MaterializeRunInputResult`
- source-manual.ts: `manualSource`, `type ManualFilePart`, `type ManualItem`
- item-key.ts: `manualItemKey`, `cardItemKey`
- run-summary.ts: `summarizeRun`, `type ListRunSummariesOptions`
- process-runner.ts: `getProcessRunner`, `setProcessRunner`
- trust-policy.ts: `decideTrust`, `isAlwaysTrusted`
- cursor-trust.ts: `sanitizeCursorProjectPath`, `cursorTrustMarkerPath`, `cursorPathVariants`, `writeCursorTrustMarker`, `removeCursorTrustMarker`, `readCursorTrustMarker`, `pathComponentCount`, `resolveCursorProjectsDir`
- `type CliTrustValue` (from contracts)
- nodes/run-state.ts: `foldEvents`, `isLiveRunStatus`, `stepTaskStatus`, `type RunState`
- nodes/step-paths.ts: `attemptRootOf`, `frozenDir`, `relOut`, `stepDir`

Not exported from the barrel (module-internal or used via relative
imports): `config.ts`, `settings.ts`, `notices.ts`, `trust*.ts` other than
the above, `engine-trust.ts`, `log-runs.ts`, `run-removal.ts`,
`delete-run.ts`, `nodes/fold-steps.ts`, `nodes/cancel.ts`,
`nodes/*-assert.ts`, `mcp/*`, `library-run-targets.ts`.

## Tests — behaviours pinned (host)

- Library: immutable revisions, atomic `current` move; pull skipped while
  fresh; scope entity built from connector kind + scope fields; Asset pins
  written before `run_started`; start fails when the pull fails and no
  revision exists; warning when one exists; rerun reuses pins,
  `refreshPins` pulls again; `pullNow` records `library_pulled` and the
  list shows pins.
- Retention: keeps pinned and current, sweeps old unpinned; never removes
  current; pull rejected at the size cap with pins intact; clear removes
  unpinned only; deleting a run releases its pins.
- Cookies: `cookies.json` mode 0600 under 0700 dirs; `removeSignIn` keeps
  library data; no cookie value leaks outside `secrets/` after a pull.
- Work copies: `git clone --shared` copy can commit; library repo gets
  `gc.auto=0`.
- Connection resolve: connector files map to Connections; no writable
  capability → read-only; work copy publish through a connector-file
  connection.
