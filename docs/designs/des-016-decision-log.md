---
id: DES-016
title: Decision log
type: direction
status: active
summary: One line per key decision with date, reason and the doc that holds it. Index only; the linked docs hold the detail.
tags: [direction, decisions, adr]
related:
  [
    DES-001,
    DES-003,
    DES-005,
    DES-006,
    DES-007,
    DES-012,
    DES-013,
    DES-014,
    DES-018,
    DES-019,
    DES-020,
    DES-021,
    DES-022,
    DES-023,
    DES-024,
    DOC-001,
    DES-025,
    DES-026,
    DES-027,
    DES-028,
    DES-029,
    DES-030,
    DES-031,
    DES-032,
    DES-033,
    DES-034,
    DES-035,
    DES-036,
  ]
updated: 2026-11-22
---

# Decision log

Index of decisions already made. Do not re-argue them here: the linked
doc holds the detail, and [DES-007](des-007-tradeoffs.md) holds the risk,
guard and revisit trigger. Add a row when a decision lands; when one is
reversed, keep the row and add a new one that says so.

## Platform and stack

| Date       | Decision                                    | Reason                                         | Holds it     |
| ---------- | ------------------------------------------- | ---------------------------------------------- | ------------ |
| 2026-11-20 | Local web app, bound to 127.0.0.1           | one developer, one machine, no hosting         | DES-001      |
| 2026-11-20 | Node and TypeScript backend                 | one language across web, server and engine     | DES-001      |
| 2026-11-20 | Hono on `@hono/node-server` as the API      | small, built-in websockets, typed `hc` client  | DES-001      |
| 2026-11-20 | Turborepo pnpm monorepo, shadcn Vite preset | shared types and UI across apps, one toolchain | DES-001, 008 |
| 2026-11-20 | Server runs with tsx, no build step         | fastest loop while local only                  | DES-007      |
| 2026-11-21 | macOS only on day one                       | one sandbox path to build (`sandbox-exec`)     | DES-006, 007 |

## Engine

| Date       | Decision                                                    | Reason                                                           | Holds it     |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| 2026-11-20 | SQLite append-only event log, state is a fold               | one source of truth, resume by replay                            | DES-003      |
| 2026-11-21 | `node:sqlite` for `app.db` (no native addon)                | built into Node 22+; sync API fits append-then-act               | DES-003, 015 |
| 2026-11-20 | Append, then act                                            | a crash can never act without a record, or act twice             | DES-003      |
| 2026-11-20 | Tasks read upstream dirs by path                            | files are the context; no copying                                | DES-002, 007 |
| 2026-11-20 | Retry and repeat are separate policies                      | failure and "not done yet" are different loops                   | DES-004      |
| 2026-11-21 | Shared condition shape for when, until, branches            | one evaluator; cheap kinds before agent (BL-011)                 | DES-004      |
| 2026-11-21 | Agent judge via CLI exit 0 / non-zero                       | same adapters as tasks; not a graph task; cached / run           | DES-004      |
| 2026-11-20 | Nested concurrency limits plus an `agents` limit            | control at global, workflow, run and group level                 | DES-003      |
| 2026-11-21 | Dynamic workflows: fan-out by spawn, no `matrix`            | agents decide the split; one mechanism instead of two            | DES-001, 005 |
| 2026-11-21 | Headless Claude/Cursor adapters + `tasks_spawned`           | file spawn under attempt `out/spawn/`; reject to input           | DES-005      |
| 2026-11-21 | Per-task instructions file, no agent limits yet             | user writes the instructions; limits wait for real need          | DES-002, 007 |
| 2026-11-21 | Approval gates with `approval: true`                        | a human can hold a task; events make it survive restarts         | DES-003      |
| 2026-11-21 | `cancelled` terminal state for tasks and runs               | cancel is not failure                                            | DES-003      |
| 2026-11-21 | Run delete keeps events with a deleted marker               | the log stays append-only; files are removed                     | DES-003      |
| 2026-11-21 | Manual retry via `task_retry_requested` event               | reopen finished runs; UI retry is not `retry.max`                | DES-003, 011 |
| 2026-11-21 | Per-attempt timeout, default 900s                           | a hung CLI must not sit in `running` until cancel                | DES-004, 019 |
| 2026-11-21 | App-owned trust for all of `FLOWAPP_HOME`                   | CLIs stay headless; the human decision stays in the app          | DES-019      |
| 2026-11-21 | Cursor agents may write under `~/.cursor`                   | CLI needs projects/chats dirs; seatbelt still limits elsewhere   | DES-006, 019 |
| 2026-11-21 | Always-trust is a settings row, bound to realpath           | not run state; the events table requires `run_id`                | DES-003, 019 |
| 2026-11-21 | Pre-run checks warn only, including paths outside           | the user can still run after a double check                      | DES-019, 007 |
| 2026-11-21 | CLI adapter, check list, and `decideTrust`                  | add a CLI or check without new layers; no plugin loader          | DES-019      |
| 2026-11-21 | Fixed prompt paths; no `instructions` key                   | yaml and the prompt file cannot drift                            | DES-020      |
| 2026-11-21 | At most one agent judge per slot                            | one slot, one file; revisit if a workflow needs two              | DES-020, 007 |
| 2026-11-21 | Leftover `instructions` keys are a parse error              | no auto-migration; the error names the target path               | DES-020      |
| 2026-11-21 | Engine generates task ids (`task-` plus 8 hex)              | ids also name folders; users should not edit them                | DES-020      |
| 2026-11-21 | Optional `name` is the display label                        | the id is no longer readable on its own                          | DES-020      |
| 2026-11-21 | Task ids are immutable; rename-and-move is dropped          | subtract the folder-move design now that ids do not change       | DES-020      |
| 2026-11-21 | Legacy ids still parse; only new ids use the pattern        | existing workflows must not break on load                        | DES-020, 007 |
| 2026-11-21 | Spawn specs are identified by file stem, not `id`           | the engine assigns the id and rewrites sibling `needs`           | DES-020, 005 |
| 2026-11-21 | `UPSTREAM_*` maps `-` in the id to `_`                      | a hyphen is not valid in a shell variable name                   | DES-020, 002 |
| 2026-11-21 | Per-run frozen `RUN_INPUT`; shared `WF_INPUT` stays         | each ticket is its own run; defaults stay on the workflow        | DES-021, 002 |
| 2026-11-21 | Optional `inputs:` of `text`, `markdown`, `file`            | Start run can show a form; the type set stays small              | DES-021, 007 |
| 2026-11-21 | Manual is the only source; more adapters later              | connectors and folder lists stay out of this cut                 | DES-021      |
| 2026-11-21 | Same item key asks, never auto-skips                        | the user decides whether to run again                            | DES-021      |
| 2026-11-21 | `maxConcurrentRuns` default 1; extras are `queued`          | one live run unless the workflow asks for more                   | DES-021, 003 |
| 2026-11-21 | Save moves a removed task folder to `tasks/.trash/`         | keep the files; do not leave orphans in `tasks/`                 | DES-022, 002 |
| 2026-11-21 | PUT diffs task ids; no client-sent remove list              | raw YAML edits follow the same path                              | DES-022, 013 |
| 2026-11-21 | Block Save-remove while a live or queued run needs the task | authored prompts are read from the workflow folder at launch     | DES-022, 007 |
| 2026-11-21 | Optional `model` and `effort`; omit flags for CLI defaults  | use each CLI's own settings when the yaml is silent              | DES-023, 005 |
| 2026-11-21 | Workflow agent defaults are per CLI                         | a Claude default must not leak onto a Cursor task                | DES-023      |
| 2026-11-21 | Cursor Effort select is mapped onto the model id            | Cursor ids embed effort; Claude uses a separate `--effort`       | DES-023      |
| 2026-11-21 | Judges get model and effort; inherit same-cli parent        | a judge can share the task's model or override it                | DES-023, 020 |
| 2026-11-21 | Unknown model is a pre-run warning, never a block           | the user can still run after a double check                      | DES-023, 019 |
| 2026-11-22 | Workflows are nodes and edges of nine kinds                 | few kinds, many variants; OpenBot's first-visit clarity          | DES-031, 032 |
| 2026-11-22 | One node kind registry per layer                            | a new kind is three files; no kind switches elsewhere            | DES-035      |
| 2026-11-22 | Steps stay stateless CLI processes, not agent queues        | sandbox and trust per attempt, as DES-005                        | DES-031      |
| 2026-11-22 | Judge node: instructions, model, effort; yes or no word     | as OpenBot's condition; unclear fails; replaces exit-code judges | DES-032, 034 |
| 2026-11-22 | Approval is a node; Reject stops the run                    | as OpenBot; replaces `approval: true`                            | DES-032, 034 |
| 2026-11-22 | Loops are back edges with `limits.loopPasses` (default 5)   | as OpenBot, plus a limit OpenBot lacks; replaces `repeat`        | DES-034      |
| 2026-11-22 | Loop entry ties break by YAML node order                    | the engine never reads the layout file                           | DES-034      |
| 2026-11-22 | Spawned steps are removed                                   | pootato's decision; reverses the 11-21 spawn rows                | DES-031, 034 |
| 2026-11-22 | LLM node runs a CLI in print mode, tools off                | no API tokens; same sign-in as agents                            | DES-032      |
| 2026-11-22 | Asset node holds library resources, pinned at run start     | chosen repos and pulled pages as wired inputs; replaces `uses`   | DES-032      |
| 2026-11-22 | Output is a node kind: folder, publish, notify              | several outputs per workflow; replaces `kind: publish`           | DES-032      |
| 2026-11-22 | Named answers and `{{name}}` templates                      | as OpenBot; a Judge can test an answer without a model           | DES-032      |
| 2026-11-22 | No migration; runs without `schemaVersion: 2` are skipped   | development phase; old workflows are deleted by hand             | DES-033, 034 |

## UI

| Date       | Decision                                                                            | Reason                                                                          | Holds it        |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------- |
| 2026-11-20 | Visual editor and `workflow.yaml` kept in sync                                      | the file is the source of truth, the graph a view of it                         | DES-002, 010    |
| 2026-11-21 | react-markdown with remark-gfm for summaries                                        | about 49 KB, never renders raw HTML                                             | DES-012         |
| 2026-11-21 | CodeMirror 6 for the YAML pane                                                      | about 141 KB with diagnostics; Monaco is about 1.1 MB                           | DES-012         |
| 2026-11-21 | React Flow with dagre, automatic layout                                             | about 16 KB; no positions to sync                                               | DES-012, 010    |
| 2026-11-21 | Run view has full controls and list plus graph                                      | answered in the run view review                                                 | DES-009, 011    |
| 2026-11-21 | Server folds runs; web applies `run_snapshot`                                       | web must not import engine (DES-015); same fold result                          | DES-009, 015    |
| 2026-11-21 | YAML writes keep comments and key order                                             | hand edits must survive graph edits                                             | DES-013         |
| 2026-11-21 | Kind switch writes a valid shape for the new kind                                   | Inspector only patched kind, so agent tasks failed save                         | DES-018         |
| 2026-11-21 | Plain textarea for memory and instructions files                                    | quicker edit in the UI; YAML pane keeps CodeMirror                              | DES-018         |
| 2026-11-21 | Add memory .md files with a native file picker                                      | on a name collision, ask to overwrite or rename                                 | DES-018         |
| 2026-11-21 | Inspector shows a fixed prompt path and Edit prompt                                 | the user no longer edits the path                                               | DES-020         |
| 2026-11-21 | Task rename moves the prompt folder in the same PUT                                 | yaml and files stay in sync                                                     | DES-020, 013    |
| 2026-11-21 | No task-id rename in the app; earlier move plan dropped                             | ids are immutable, so folder moves are not needed                               | DES-020         |
| 2026-11-21 | Inspector shows a read-only id and an editable name                                 | the id is generated; name is what the user sees                                 | DES-020         |
| 2026-11-21 | Start run form, then trust, then a duplicate ask                                    | reuse TrustStartGate; never auto-skip                                           | DES-021, 011    |
| 2026-11-21 | Run view shows the run's frozen input files                                         | retry and resume must match what the user sees                                  | DES-021, 009    |
| 2026-11-21 | Inspector edits `inputs:` and `maxConcurrentRuns`                                   | the yaml stays the source of truth                                              | DES-021, 010    |
| 2026-11-21 | Delete one task from the drawer or canvas, with confirm                             | pending edit until Save; dependents lose the link                               | DES-022, 010    |
| 2026-11-21 | Snapshot undo for graph and inspector edits                                         | no undo existed; YAML pane keeps CodeMirror history                             | DES-022, 010    |
| 2026-11-21 | Drawer Model and Effort selects, Default first                                      | the first option shows the CLI's current setting                                | DES-023, 010    |
| 2026-11-21 | Run view shows model and effort on the attempt                                      | record what was actually resolved                                               | DES-023, 009    |
| 2026-11-21 | shadcn base-nova defaults are the only style source                                 | no custom tokens or density; keep the kit stable                                | DES-024, 008    |
| 2026-11-21 | Lint bans arbitrary values and palette colors in apps/web                           | generated shadcn files keep theirs, never hand-edited                           | DES-024         |
| 2026-11-21 | shadcn Sidebar shell with workflows and Settings                                    | replaces the hand-rolled nav; no icon-only mode                                 | DES-024, 019    |
| 2026-11-21 | One UI; YAML, env and raw logs behind Advanced                                      | one product for POs and developers                                              | DES-024         |
| 2026-11-21 | Theme default light; dark and system stay                                           | the `d` shortcut still toggles                                                  | DES-024, 008    |
| 2026-11-21 | No Simple/Pro mode; detail lives in Tabs                                            | one UI for all; replaces the Advanced switch                                    | DES-025         |
| 2026-11-22 | Tasks use a local copy of outside systems                                           | pull, work locally, publish: only publish affects others                        | DES-025         |
| 2026-11-22 | Work item is a saved record; many per workflow                                      | the user's unit of work is not a workflow or task node                          | DES-026         |
| 2026-11-22 | One central library, pulled by entity on demand                                     | reuse across work items; runs pin revisions; read-only                          | DES-026         |
| 2026-11-22 | Secrets in macOS Keychain, one item per connection                                  | never in files or logs; reversed below: no Keychain                             | DES-026         |
| 2026-11-22 | Trust never publishes on doubt or destructive ops                                   | agent escalate, error or delete falls back to approval                          | DES-026         |
| 2026-11-22 | Change set envelope per source; conflicts not merged                                | one UI for all connectors; pull again or discard                                | DES-026         |
| 2026-11-22 | Library retention: pinned kept, 7 days, 5 GB cap                                    | reproducible runs without unbounded disk use                                    | DES-026         |
| 2026-11-22 | GitHub is the first connector                                                       | delegated sign-in, shared clone, draft PR is undoable                           | DES-026         |
| 2026-11-22 | Publish policy per connection                                                       | read only, approve each publish, or trust agent review                          | DES-025         |
| 2026-11-22 | Page owns padding; `data-bleed` children go full width                              | no page sets its own padding; alerts keep their own inset                       | DES-027         |
| 2026-11-22 | Table primitive owns row size, border, truncation, `py-0`                           | every table is 41px header, 37px rows; no per-page classes                      | DES-027         |
| 2026-11-22 | Trust-agent-review judge is Claude with DES-023 defaults                            | no per-connection CLI; escalate/error/timeout/destructive wait                  | DES-026, BL-052 |
| 2026-11-22 | Connection access declared and warned                                               | no network blocking yet; credentials never reach tasks                          | DES-025         |
| 2026-11-22 | No Keychain; reverses the Keychain row above                                        | any user process reads it via `security`; tasks too                             | DES-026         |
| 2026-11-22 | Sign-in is CLI-owned, allowed local MCP, or cookies                                 | no API tokens; cookies from a Chrome sign-in by Flows                           | DES-026         |
| 2026-11-22 | MCP allowlist is `mcp-trust.json` (command or URL keys)                             | same allow-before-run as CLI trust; file avoids app.db locks                    | DES-026, BL-054 |
| 2026-11-22 | Cookies in `secrets/`, 0700, sandbox denies reads                                   | enforced for sandboxed tasks, unlike the Keychain                               | DES-026         |
| 2026-11-22 | Connectors are in-repo adapters only                                                | no plugin loading; J12 is a pull request                                        | DES-026         |
| 2026-11-22 | Repo work copy is `git clone --shared`, no worktree                                 | worktree metadata is outside the sandbox write root                             | DES-026         |
| 2026-11-22 | Port lease per attempt, `serial` repos, local caches                                | parallel copies do not clash; installs work sandboxed                           | DES-026         |
| 2026-11-22 | Waiting is derived (`needsYou`), no new run status                                  | no event or fold change; old runs fold unchanged                                | DES-025         |
| 2026-11-22 | Publish is a `kind: publish` task the user places                                   | the graph decides when; reuses the approval gate                                | DES-026         |
| 2026-11-22 | Run `resources/` folder with every pin, for all tasks                               | a work item's context is readable without YAML                                  | DES-026         |
| 2026-11-22 | Pins are taken at start, frozen like inputs                                         | queued runs too; "Rerun with fresh pull" pins again                             | DES-026         |
| 2026-11-22 | Work item ids are generated slugs from the title                                    | POST creates the id; callers do not choose one                                  | DES-026         |
| 2026-11-22 | Delete moves a work item to `workitems/.trash/`                                     | keep files; never delete runs when removing an item                             | DES-026         |
| 2026-11-22 | Run `itemKey` comes from `workItemId` when set                                      | duplicate warn is per work item and workflow; ad hoc unchanged                  | DES-026, BL-039 |
| 2026-11-22 | GitHub publish branch is `flows/<runId>/<publishTaskId>`                            | unique per publish; clash with other commits is conflict                        | DES-026, BL-050 |
| 2026-11-22 | Renovation builds on shadcn components, blocks, AI Elements                         | base-nova defaults stay the only style source; no new tokens                    | DES-027         |
| 2026-11-22 | DX covers people using Flows and us building it                                     | detail one step away; folders, lint guards and a layout check                   | DES-030         |
| 2026-11-22 | New users start from a work item, then a workflow                                   | the work item is the front door, also on first launch                           | DES-028         |
| 2026-11-22 | Run view leads with a run summary, then the tasks                                   | status and cause first; tasks get more height                                   | DES-029         |
| 2026-11-22 | Task settings in a right Sheet over a full-width graph                              | the graph keeps its width; the Inspector panel goes                             | DES-028         |
| 2026-11-22 | Controls 32px by default; small sizes only in dense rows                            | one height and one radius per row                                               | DES-027         |
| 2026-11-22 | Readable names and relative times first; ids secondary                              | ids stay copyable in mono; no raw UTC in labels                                 | DES-027, 030    |
| 2026-11-22 | Renovation order: frame, run view, editor, home and lists                           | command palette later (BL-072)                                                  | DES-017, 027    |
| 2026-11-22 | Developer details in fixed tabs; no Advanced switch                                 | YAML, ids, env, raw logs one step away; confirms the 11-21 row                  | DES-027, 030    |
| 2026-11-22 | Optional `name` in workflow.yaml as the display label                               | readable names without renaming folders; id stays the key                       | DES-002, 027    |
| 2026-11-22 | No `name` falls back to the humanized folder id                                     | old workflows read well with no file change                                     | DES-027, BL-073 |
| 2026-11-22 | Create asks for Name; the folder id is its slug, editable                           | people type a name, not a folder; id stays the stable key                       | DES-027, BL-073 |
| 2026-11-22 | Run label is the work item title, else "Ad hoc run"                                 | runs have no name of their own; UUID stays in IdText                            | DES-029, BL-059 |
| 2026-11-22 | AI Element files carry a shadcn source comment; env vars live in `components/data/` | shadcn demos are chat-wired; ours are app-specific adaptations                  | DES-027, BL-060 |
| 2026-11-22 | One Start dialog everywhere; preflight returns `clis`                               | trust copy names Cursor or Claude Code; one path to start                       | DES-029, BL-064 |
| 2026-11-22 | Node positions saved in `workflow.layout.json`                                      | as OpenBot saves positions; YAML diffs stay clean; reverses the 11-21 dagre row | DES-033         |
| 2026-11-22 | Canvas first: settings and results on nodes, Sheet for the rest                     | OpenBot's clarity; amends the 11-22 task Sheet row                              | DES-036         |
| 2026-11-22 | Add node menu in Inputs, Steps and Flow with search                                 | as OpenBot; dragging a wire to empty canvas adds a node                         | DES-036         |

## Docs and tooling

| Date       | Decision                                        | Reason                                                   | Holds it         |
| ---------- | ----------------------------------------------- | -------------------------------------------------------- | ---------------- |
| 2026-11-20 | One frontmatter schema, generated indexes       | agents find docs in few reads; checked by `docs:check`   | DOC-001          |
| 2026-11-20 | Index files unpadded, skip prettier             | 33 to 60 percent smaller                                 | DES-007          |
| 2026-11-21 | `direction` docs listed first in the root index | vision, architecture, decisions and roadmap in one place | DOC-001          |
| 2026-11-21 | Keep code clean, refactor proactively, bounded  | cleaner code without churn; refactors in own commits     | `clean-code.mdc` |
