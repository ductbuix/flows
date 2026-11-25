# `e2e` — Playwright end-to-end suite

Path: `apps/e2e`. Drives the real stack (Hono server on 8787 + Vite web on 5173) against a throwaway `FLOWAPP_HOME` seeded with fixture workflows,
docket cards, connectors, library items and skills. Talks to the engine
only through the browser and through a tiny FCP JSON-RPC-over-WebSocket
helper (never REST). Run with `pnpm test:e2e` from the root (turbo →
`playwright test`). Part of "done" for UI or API changes.

## package.json

```json
{
  "name": "e2e",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test:e2e": "playwright test",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.65.1",
    "@types/node": "^26.6.6",
    "eslint": "^10.15.0",
    "globals": "^17.14.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.73.0"
  }
}
```

No workspace dependencies (the suite deliberately avoids `@workspace/sdk`).
Root `turbo.json` task `test:e2e`: `cache: false`, `passThroughEnv: [CI,
FLOWAPP_HOME, FLOWAPP_CURSOR_PROJECTS, PW_WEB_PORT, PW_API_PORT,
PW_API_BASE, PW_VIDEO, PW_SCREENSHOT]`. Root `.gitignore` ignores
`test-results` and `playwright-report`.

## tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "noEmit": true
  },
  "include": ["fixtures", "playwright.config.ts", "tests"]
}
```

Root tsconfig: `target ES2022, module ESNext, moduleResolution bundler,
skipLibCheck, strict`. Imports between e2e files are extensionless.

## eslint.config.js

Same shape as `docs-tools`: `globalIgnores(["dist"])`, `noCycleBlock`,
`**/*.ts` with `@eslint/js` + `typescript-eslint` recommended and
`globals.node`, `max-lines` warn 200 (300 for `*.test.*` / `*.spec.*`),
skipping blank lines and comments.

## File tree

```
apps/e2e/
  package.json, tsconfig.json, eslint.config.js
  playwright.config.ts           ports, env, temp home, web servers
  fixtures/
    home.ts                      createE2eHome(): mkdtemp + all seeders
    fake-acp-agent.mjs           NDJSON ACP agent stub (copied to <home>/bin/agent)
    home/bin.ts                  stub `claude` + `agent`, stub `gh`
    home/template-run.ts         nodeRunYaml(id, run, trigger?) template
    home/workflows-canvas.ts     diamond, card-slow, node-settings-e2e, canvas-edit-e2e, node-canvas, node-cards, empties, sheets
    home/workflows-run.ts        run ok/fail, out-preview, step, history, start inputs, view, sheet-delete-demo, node-run-none
    home/workflows-judge.ts      judge (rule) and judge check-mode workflows
    home/workflows-gates.ts      approval and notify-output workflows
    home/workflows-assets.ts     asset node and publish-output workflows
    home/workflows-loop.ts       judge loop workflows (+ loop warning)
    home/workflows-llm.ts        llm workflows, named answers, add-an-llm
    home/workflows-acp.ts        cursor ACP permission / question / plan-review
    home/docket.ts               docket board + 2 cards
    home/connectors.ts           github-cli + rally connectors
    home/library.ts              library items github-acme-demo, local-notes
    home/library-skills.ts       repo-team-skills library item (skill source)
    home/skills.ts               workspace skills, skills/sources.json, skill-uses workflow
  tests/
    helpers.ts                   fcpRequest, startRun, cancelLiveRuns, e2eHome
    docket-helpers.ts            screenshotThemes, uniqueTitle, cardIdForTitle, gotoDocket, createCard, openFixLogin
    *.spec.ts                    17 spec files (below)
    layout.spec.ts-snapshots/    18 baselines: <route>-<light|dark>-chromium-darwin.png
```

## playwright.config.ts

Runs in the Playwright runner process before any test, so it can seed
the home and set env for the web servers.

| Setting                   | Value                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `video`                   | `process.env.PW_VIDEO ?? "on"` (`on` / `off` / `retain-on-failure` / `on-first-retry`) |
| `screenshot`              | `process.env.PW_SCREENSHOT ?? "on"` (`on` / `off` / `only-on-failure`)                 |
| Web port                  | `PW_WEB_PORT ?? "5173"`, `WEB = http://127.0.0.1:<port>`                               |
| API port                  | `PW_API_PORT ?? "8787"`, `API = http://127.0.0.1:<port>`                               |
| `FLOWAPP_HOME`            | env value, else `createE2eHome()`; written back to `process.env.FLOWAPP_HOME`          |
| `FLOWAPP_CURSOR_PROJECTS` | env value, else `${FLOWAPP_HOME}/.cursor-projects`                                     |
| `PW_API_BASE`             | set to `API` (read by `tests/helpers.ts`)                                              |
| `PATH`                    | `${FLOWAPP_HOME}/bin:` prepended (stub `claude`, `agent`, `gh` win)                    |
| `testDir`                 | `tests`                                                                                |
| `outputDir`               | `test-results`                                                                         |
| `fullyParallel`           | `false`                                                                                |
| `workers`                 | `1` (one shared FLOWAPP_HOME; parallel workers would race on fixtures)                 |
| `forbidOnly`              | `!!process.env.CI`                                                                     |
| `retries`                 | `CI ? 1 : 0`                                                                           |
| `reporter`                | `[["list"], ["html", { open: "never" }]]`                                              |
| `use`                     | `baseURL: WEB`, `trace: "retain-on-failure"`, `video`, `screenshot`                    |
| `projects`                | one: `chromium` with `devices["Desktop Chrome"]`                                       |

`webServer` (both `cwd: "../.."`, `reuseExistingServer: !CI`, env =
every defined `process.env` entry, i.e. after the mutations above):

1. `pnpm --filter server start`, ready on `${API}/health`, extra env:
   `FLOWAPP_HOME`, `FLOWAPP_CURSOR_PROJECTS`, `FLOWAPP_RETRY_BACKOFF_MS=50`,
   `FLOWAPP_FAKE_CONNECTOR=1`, `PORT=<API_PORT>`, `PW_WEB_PORT=<WEB_PORT>`
   (so the FCP Origin allowlist accepts this Vite port).
2. `pnpm --filter web exec vite --port <WEB_PORT> --strictPort`, ready on
   `WEB`, extra env `PW_API_PORT=<API_PORT>` (Vite proxies `/fcp` and
   `/blobs` there).

Snapshot settings live in `layout.spec.ts` (`toHaveScreenshot` with
`maxDiffPixelRatio: 0.01`); Playwright's default snapshot path template
gives `tests/layout.spec.ts-snapshots/<name>-chromium-darwin.png`.

Server-side env semantics the suite depends on (implemented by the
server, specified there): `FLOWAPP_FAKE_CONNECTOR=1` makes
`apps/server/src/index.ts` also `registerConnector(fakeConnector)` (the
test-only `fake` connector) next to
the builtins; `FLOWAPP_RETRY_BACKOFF_MS` shortens retry backoff. The
connector specs' expectations (rally `cookies` checks to tone
`attention`; github-cli `cli-login` checks to `done` through the stub
`gh --version`) come from the normal connector check logic.

## fixtures/home.ts — temp `FLOWAPP_HOME`

```ts
export function createE2eHome(): string
```

`mkdtempSync(join(tmpdir(), "flowapp-e2e-nodes-"))`, then calls, in
order: `seedCanvasWorkflows, seedRunWorkflows, seedJudgeWorkflows,
seedGateWorkflows, seedAssetWorkflows, seedLoopWorkflows, seedFakeCli,
seedLlmWorkflows, seedAcpWorkflows, seedSheetDelete,
seedAnswersWorkflows, seedNoTriggerRun, seedDocket, seedConnectors,
seedGhStub, seedLibraryItems, seedWorkspaceSkills, seedRepoTeamSkills,
seedSkillSources, seedSkillUses`; returns the path. Every seeder takes
`home: string` and writes with `mkdirSync({ recursive: true })` /
`writeFileSync`. Workflow files live at
`<home>/workflows/<id>/workflow.yaml`, optional
`workflow.layout.json` and `nodes/<nodeId>/<file>.md`.

### Workflow templates

`nodeRunYaml(id, run, trigger = true)` (template-run.ts):

```yaml
id: <id>
goal: e2e node run
nodes:
  - id: start # only when trigger
    kind: trigger
    type: manual
  - id: build
    kind: command
    run: <JSON.stringify(run)>
  - id: done
    kind: output
    target: folder
edges:
  - { from: start, to: build } # only when trigger
  - { from: build, to: done }
```

Layout files are `{"version":1,"nodes":{<id>:{"x","y"}},"viewport":{x,y,zoom}}`
(viewport optional).

### Seeded workflows

| Seeder (file)                | Workflow ids                                                     | Shape                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| canvas                       | `diamond`                                                        | `nodeRunYaml(…, "echo diamond")` + layout start(40,80) build(420,80) done(800,80), viewport (0,0,0.75)                                                                                                                                  |
| canvas                       | `card-slow`                                                      | `nodeRunYaml(…, "sleep 60")` (long-lived run to cancel)                                                                                                                                                                                 |
| canvas                       | `node-settings-e2e`                                              | `nodeRunYaml(…, "echo settings")` + same layout as diamond                                                                                                                                                                              |
| canvas                       | `canvas-edit-e2e`                                                | start(trigger manual), plan(llm, cli claude, `nodes/plan/prompt.md` = `Plan it.\n`), done(output target notify, title Done); **no edges**; layout start(0,0) plan(380,0) done(900,0), viewport (40,120,1)                               |
| canvas                       | `node-canvas`                                                    | start → write(agent, claude) → done(output folder)                                                                                                                                                                                      |
| canvas                       | `node-cards`                                                     | start → plan(agent claude, prompt `Plan the work.\n`) ← rules(prompt, `nodes/rules/text.md` = `Be brief.\n`); plan → build(command `echo build`) → done                                                                                 |
| canvas                       | `node-empty-light`, `node-empty-dark`, `node-sample`             | `nodes: []`, `edges: []`, goal `e2e empty node workflow`                                                                                                                                                                                |
| canvas                       | `node-sheet-light`, `node-sheet-dark`                            | start → plan(agent claude) → build(echo build) → done; `nodes/plan/prompt.md` `Plan it.\n`, `memory/style.md` `Be brief.\n`                                                                                                             |
| run                          | `node-run-ok-{light,dark}`                                       | `nodeRunYaml(…, "echo built")`                                                                                                                                                                                                          |
| run                          | `node-run-fail-{light,dark}`                                     | `nodeRunYaml(…, "echo broken >&2; exit 1")`                                                                                                                                                                                             |
| run                          | `node-out-preview`                                               | `nodeRunYaml(…, 'printf "hello out\\n" > "$NODE_OUT/text.md"')`                                                                                                                                                                         |
| run                          | `node-step-{light,dark}`, `node-history-{light,dark}`            | `nodeRunYaml` echo `stepped` / `history`                                                                                                                                                                                                |
| run                          | `node-start-{light,dark}`, `node-start-run`                      | start(trigger manual, `inputs: [{ name: ticket, type: text, required: true }]`) → build(`cat "$RUN_INPUT/ticket.txt"`) → done; review(agent claude, prompt `Review it.\n`) unconnected                                                  |
| run                          | `node-view-{light,dark}`                                         | failing nodeRunYaml + layout start(0,0) build(400,120) done(800,0)                                                                                                                                                                      |
| run (`seedSheetDelete`)      | `sheet-delete-demo`                                              | `nodeRunYaml(…, "echo sheet-delete")`                                                                                                                                                                                                   |
| run (`seedNoTriggerRun`)     | `node-run-none`                                                  | `nodeRunYaml(…, "echo built", false)` (no trigger)                                                                                                                                                                                      |
| judge                        | `node-judge-{light,dark,light-view,dark-view}`                   | start → check(judge, claude; `nodes/check/rule.md` `Is the request reasonable?\n`); check →yes approved(`echo took-yes`), →no rejected(`echo took-no`)                                                                                  |
| judge                        | `node-judge-add`                                                 | empty workflow, goal `e2e add a judge`                                                                                                                                                                                                  |
| judge                        | `node-judge-check-{light,dark,light-view,dark-view}`             | start → assess(llm claude, answers `risk` choice [low, high], `score` number; prompt `Assess the weather.\n`) → check(judge, `mode: check`, `check: { field: risk, operator: "=", value: high }`) → yes/no as above                     |
| gates                        | `node-approval-{light,dark,reject,home}`                         | start → gate(approval, `question: Ship the change?`) → after(`echo shipped`)                                                                                                                                                            |
| gates                        | `node-notify-{light,dark}` / `node-notify-sheet`                 | start → build(`echo build is green`) → tell(output `target: notify`, `title: Build finished` / `target: folder`)                                                                                                                        |
| assets                       | `node-asset-{light,dark}`                                        | start → read(`cat "$RESOURCE_ASSET_DEMO/repo/alpha/data.txt"`) ← lib(asset, `resources: []`, `access: read`)                                                                                                                            |
| assets                       | `node-publish-{light,dark,reject,ledger}`                        | lib(asset, `access: propose`, resources `[{ connection: pub-demo, entity: item, id: alpha }]`) → edit(`echo changed > "$RESOURCE_PUB_DEMO/item/alpha/data.txt"`) ← start; edit → ship(output `target: publish`, `connection: pub-demo`) |
| assets                       | `node-publish-sheet`                                             | same with `access: read`, ship `target: folder`                                                                                                                                                                                         |
| loop                         | `node-loop-{light,dark,view-light,view-dark}`, `node-loop-limit` | start → draft(`echo drafted`) → check(judge claude); check →no draft, →yes ship(`echo shipped`); rule.md `until-pass 3` (limit: `until-pass 99` and top-level `limits: { loopPasses: 2 }`) + `Is the draft good?`                       |
| loop                         | `node-loop-warn`                                                 | start → one → two → one (cycle with no judge)                                                                                                                                                                                           |
| llm                          | `node-llm-{light,dark,light-view,dark-view}`                     | start → write(llm, claude; prompt `Write one line about the weather.\n`) → show(`cat $NODE_IN/text.md`)                                                                                                                                 |
| llm                          | `node-llm-acp`                                                   | same with `cli: cursor`                                                                                                                                                                                                                 |
| llm (`seedAnswersWorkflows`) | `node-answers-{light,dark,sheet-light,sheet-dark}`               | start → assess(llm, answers risk/score) → note(llm, prompt `Risk is {{risk}}, score {{score}}.\n`) → show(`cat $NODE_IN/text.md`)                                                                                                       |
| llm                          | `node-llm-add`                                                   | empty, goal `e2e add an llm`                                                                                                                                                                                                            |
| acp                          | `agent-acp-ask`                                                  | `{ id: start, kind: trigger, type: manual }` → `{ id: work, kind: agent, cli: cursor }`; prompt `ASK_PERMISSION then finish.\n`                                                                                                         |
| acp                          | `agent-acp-question`                                             | same, prompt `ASK_QUESTION then finish.\n`                                                                                                                                                                                              |
| acp                          | `agent-acp-plan`                                                 | start → `{ id: write, kind: llm, cli: cursor, planReview: ask }`; prompt `ASK_PLAN_REVIEW then finish.\n`                                                                                                                               |
| skills (`seedSkillUses`)     | `skill-uses-write-tests`                                         | start → draft(llm claude, `name: Draft with tests skill`, `skills: [write-tests]`, prompt `Draft it.\n`) → done(output folder)                                                                                                          |

Goals are `e2e …` strings (e.g. `e2e node canvas`, `e2e judge node`); the
`nodeRunYaml` goal `e2e node run` is asserted by `workflows.spec.ts`.
Many fixtures exist for specs not in this folder today (node-*.spec.ts
names in comments); they are harmless extra workflows in lists.

### Other seeded data

- **Docket** (`docket.ts`): `docket/board.yaml`:
  `version: 1`, columns `todo/Todo/idle`, `doing/Doing/working`,
  `review/Review/attention`, `done/Done/done (done: true)`, `face: []`.
  Card `docket/cards/fix-login/card.md` frontmatter: id `fix-login`,
  title `Fix flaky login`, status `doing`, rank `m`, created
  `2026-11-20T09:12:00Z`, updated `2026-11-23T10:00:00Z`, due
  `2026-11-28`, `refs: [{ system: rally, id: US1234, label: Login flake
on CI, syncedAt: 2026-11-23T10:00:00Z, data: { State: In progress,
Iteration: Sprint 42, Owner: flows } }]`, `assets: [{ path:
assets/acceptance.md, label: Acceptance criteria }]`; body
  `Stabilize the login e2e.`; asset file
  `assets/acceptance.md` = `# Acceptance\n\nLogin stays green for 20
runs.\n`. Card `refactor-auth`: title `Refactor auth session`, status
  `todo`, rank `m`, created `2026-11-21T09:00:00Z`, updated
  `2026-11-23T10:00:00Z`, body `Pull session handling into one module.`
- **Connectors** (`connectors.ts`): `connectors/github-cli.yaml` (id
  `github-cli`, name GitHub, transport `cli`, how `gh`, auth
  `cli-login`, providerId `github`, capabilities `repo clone` (read,
  allowed, cmd `[repo, clone]`), `repo push` (write, allowed, `[repo,
push]`), `pr merge` (write, not allowed, `[pr, merge]`)) and
  `connectors/rally.yaml` (id `rally`, name Rally, transport `api`, how
  `https://rally.example/api`, auth `cookies`, capability `artifact read`
  read/allowed).
- **Library** (`library.ts`): `library/github-acme-demo/item.yaml`
  (kind `repo`, title `acme/demo`, source `github`, remoteId
  `acme/demo`, remoteUrl `https://github.com/acme/demo`, tags
  `repo:acme/demo`, `project:e2e`, current 2) with `v1/` (`.version.yaml`
  n 1, at `2026-11-20T10:00:00.000Z`, note `First fetch`, contentHash
  `hash-v1`; `README.md` `version one`) and `v2/` (n 2,
  `2026-11-22T12:00:00.000Z`, `Second fetch`, `hash-v2`; `README.md`
  `version two`); `library/local-notes` (kind `other`, title `Scratch
notes`, source `local`, tags `type:notes`, current 1; v1 at
  `2026-11-18T09:00:00.000Z`, note `Imported`, hash `hash-notes`,
  `notes.md` `# Notes`).
- **Skill source** (`library-skills.ts`): `library/repo-team-skills`
  (kind repo, title `team/skills`, source github, remote `team/skills`,
  tag `repo:team/skills`, current 2). v1 and v2 each hold
  `skills/write-tests/SKILL.md` and `skills/review-pr/SKILL.md` as
  `---\nname: <slug>\ndescription: <desc>\n---\n\n# <slug>\n\n- rule…\n\n<!-- v1|v2 -->\n`.
  write-tests ("Write focused unit tests for a changed file.") rules v1:
  Read the diff first, One behaviour per test; v2 adds `Cover the edge`.
  review-pr ("Review a pull request for correctness and risk.") v1:
  Start with the riskiest file; v2 adds `Separate must-fix from nits`.
  Version notes/hashes: `First fetch`/`skills-v1`,
  `Second fetch`/`skills-v2`.
- **Workspace skills** (`skills.ts`): `write-tests` installed at
  `<home>/.agents/skills/write-tests/SKILL.md` **and**
  `<home>/.claude/skills/write-tests/SKILL.md` with frontmatter `from: {
sourceId: repo-team-skills, version: 1 }` and the v1 rules (so an
  update is available); `<home>/.cursor/skills/commit-style/SKILL.md`
  ("Write commit messages in this repo's style.", rule Imperative mood).
  `<home>/skills/sources.json` = `{"sources":["repo-team-skills"]}` +
  newline (2-space JSON).

### Stub CLIs (`home/bin.ts`, all mode 0755 under `<home>/bin`)

- `claude` (POSIX sh):
  - If args contain `--tools` (an LLM call with tools off): read stdin
    prompt; if it contains `## Answer`, print
    ` ```json\n{"risk":"high","score":3}\n```\n ` and exit 0; else print
    `Summary: <first prompt line>` and exit 0.
  - Otherwise (judge call): `n` = number from a line `until-pass N` in
    `input/rule.md` (cwd-relative); `p` = pass number parsed from `$PWD`
    matching `…pass-<p>/attempt…`; print `no` if both are set and
    `p < n`, else `yes`.
- `agent`: a copy of `fixtures/fake-acp-agent.mjs`.
- `gh` (`seedGhStub`): `--version` → `gh stub 0.0.0`; `repo push` →
  `{"note":"Stub push"}`; anything else (fetch) increments a counter in
  `$FLOWAPP_HOME/.gh-pull-n` and prints
  `{"files":{"README.md":"pull-<n>"},"note":"Stub fetch <n>"}`.

### fake-acp-agent.mjs

Node script (shebang `#!/usr/bin/env node`). `--version`/`-v` prints
`0.0.0-fake-acp`; without an `acp` argument it errors (exit 1, stderr
`fake agent: only \`acp\` is supported`). Speaks NDJSON JSON-RPC 2.0 on
stdio:

| Inbound                   | Reply                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialize`              | `{ protocolVersion: 1, agentCapabilities: { loadSession: false, promptCapabilities: { image: false, audio: false, embeddedContext: true } }, agentInfo: { name: "fake-acp-agent", version: "0.0.0" }, authMethods: [] }`                                                                                                                                |
| `authenticate`            | `{}`                                                                                                                                                                                                                                                                                                                                                    |
| `session/new`             | `{ sessionId: "e2e_sess" }`                                                                                                                                                                                                                                                                                                                             |
| `session/prompt`          | optional client request (below), then notification `session/update` `{ sessionId, update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } } }` with `text = "Summary: <first line of first text block>"` (or `"ok"`), then result `{ stopReason: "end_turn" }`; client-request error → JSON-RPC error `-32000` with the message |
| other request             | error `-32601` `Method not found: <method>`                                                                                                                                                                                                                                                                                                             |
| responses to its requests | resolve the pending client request by id                                                                                                                                                                                                                                                                                                                |

Prompt markers (all text blocks joined by `\n`):

- `ASK_PERMISSION` → `session/request_permission` `{ sessionId, toolCall:
{ toolCallId: "e2e_tc1", title: "Write file", kind: "edit", status:
"pending" }, options: [{ optionId: "allow-once", name: "Allow once",
kind: "allow_once" }] }`.
- `ASK_QUESTION` → `cursor/ask_question` `{ toolCallId: "e2e_q1", title:
"Need input", questions: [{ id: "q1", prompt: "Which mode?", options:
[{ id: "agent", label: "Agent" }, { id: "plan", label: "Plan" }] }] }`.
- `ASK_PLAN_REVIEW` → `cursor/create_plan` `{ toolCallId: "e2e_p1", name:
"E2E plan", overview: "Ship inbox e2e", plan: "1. Add fixtures.\n2. Run
tests.", todos: [{ id: "todo-1", content: "Fixtures", status:
"completed" }, { id: "todo-2", content: "Specs", status: "pending" }] }`.

## tests/helpers.ts

- `API = PW_API_BASE ?? "http://127.0.0.1:8787"`, `WEB_ORIGIN =
http://127.0.0.1:${PW_WEB_PORT ?? "5173"}`.
- `fcpRequest(method, params = {}): Promise<unknown>`: `GET
${API}/fcp/bootstrap` with header `Origin: WEB_ORIGIN` (throws `fcp
bootstrap failed: <status>` on non-OK) → `{ url, token }`; opens
  `new WebSocket(url + "?token=<token>")` (global `WebSocket`; throws
  `WebSocket is not available` / `WebSocket failed to open`); sends
  `initialize { protocolVersion: 1, clientInfo: { name: "e2e", version:
"0.0.0" }, clientCapabilities: {} }` (id 1), then the call (id 2);
  rejects with `error.message` on JSON-RPC errors; always closes the
  socket.
- `startRun(workflowId)`: `run/start { workflowId, requestKey:
crypto.randomUUID() }` → returns `runId`.
- `cancelLiveRuns(workflowId)`: `run/list { limit: 100 }`; for each item
  of that workflow with status `running` or `queued`, `run/cancel {
runId, requestKey }` (errors ignored).
- `e2eHome()`: `process.env.FLOWAPP_HOME` or throw `FLOWAPP_HOME is not
set`.

FCP methods used by the suite: `initialize`, `run/start`, `run/list`,
`run/get` (`{ id }` → `{ status }`), `run/cancel`, `inbox/list` (→ `{
items: { id, kind, status, runId? }[] }`), `inbox/dismiss { itemId,
requestKey }`, `connector/check { id }`, `settings/set_mcp_trust { key,
grant: "always" }`.

## tests/docket-helpers.ts

- `screenshotThemes(page, name)`: full-page screenshot to
  `test-results/<name>-light.png`; click body at (0,0); press `d`; expect
  `<html>` class `/dark/`; screenshot `<name>-dark.png`; press `d`;
  expect class `/light/`. (connectors, files, library, skills and
  workflows specs carry an identical local copy.)
- `uniqueTitle()` → `bl216-${Date.now()}`.
- `cardIdForTitle(title)`: lowercase, non `[a-z0-9]` runs → `-`, trim
  dashes, max 40 chars, fallback `card` (must match the server's slug).
- `gotoDocket(page)`: `/docket`, wait `docket-page`.
- `createCard(page, title, { column?, body?, ref? })`: click
  `docket-add-<column>` or `docket-new-card-open`; dialog
  `docket-new-card`; fill `docket-new-card-title`, optional
  `docket-new-card-ref` and `#nc-body`; click `docket-new-card-submit`;
  expect `docket-panel` and `docket-card-<id>` visible; returns id.
- `openFixLogin(page)`: docket → click `docket-card-fix-login` → expect
  `docket-panel`.

## Specs (17 files)

Notation: `[tid]` = `getByTestId(tid)`. All timeouts are Playwright
defaults unless given.

### agent-acp-ask.spec.ts — "agent ACP permission ask (BL-195)"

- **permission inbox item resumes the core agent run**: `startRun
("agent-acp-ask")`; poll `inbox/list` (20 s) for an item with `kind
=== "permission"` whose id contains the run id; `/inbox`; expect
  `[inbox-item-<id>]`; click `[inbox-allow-once-<id>]`; item count 0
  (15 s); poll `run/get` until `status === "succeeded"` (20 s).

### brand.spec.ts — "brand"

- **lists every mockup and opens each one**: `/brand` shows
  `[brand-page]` and `[brand-card-<id>]` for ids `status, create-form,
kanban, canvas, run-card, detail-panel, node-ask, node-logs`;
  screenshot `test-results/brand.png`; then each `/brand/<id>` shows
  `[brand-mockup-<id>]` and `[brand-stage]`, screenshot
  `brand-<id>.png`.
- **run card switches between running and done**: `/brand/run-card`,
  within `[mockup-run-card]` text `3 working`; click button "Stop";
  `Done` (exact) and `Answer` visible.

### connectors.spec.ts

"connectors page (BL-207)":

- **sign in check**: FCP `connector/check { id: "rally" }`;
  `/connectors`; `[connector-row-rally] [connector-status]` has
  `data-tone="attention"`; click `[connector-row-github-cli]`;
  `[connector-sheet]` visible, its `[connector-action]` text `Check CLI
login`; click it; sheet `[connector-status]` `data-tone="done"` (15 s);
  action text becomes `Test`.
- **disconnect**: check github-cli via FCP; open its sheet; status done
  (15 s); tab "Setup"; click `[connector-disconnect]`; status
  `data-tone="idle"`.
- **used by**: open github-cli; click `[connector-tab-used]`;
  `[connector-used-by]` visible; `[connector-used-library]` contains `2
linked items` (acme/demo + team/skills are github-sourced).
- **update**: open rally; tab Setup; fill `[connector-edit-how]` with
  `https://rally.example/v2`; `[connector-save]`; button "Close"; sheet
  count 0; reopen → Setup → value persisted.

"connectors page (BL-181 / BL-216)":

- **list add**: `[connectors-page]`, rows github-cli and rally;
  `screenshotThemes("connectors-page")`; `[connector-add-open]` →
  `[connector-add]`; fill `[connector-add-name]` `Wiki <stamp>`,
  `[connector-add-how]` `https://wiki.example/api`; submit
  `[connector-add-submit]`; a row `[data-testid^="connector-row-wiki-"]`
  appears and the sheet opens.
- **capabilities**: github-cli sheet shows `[capability-repo clone]`;
  the control labelled `Allow repo push` toggles checked state and back.
- **remove**: add `Temp <stamp>` (`https://temp.example/api`); row
  `connector-row-temp-*`; Setup tab; `[connector-remove]`;
  `[confirm-ok]`; row gone, github-cli still present.

### dev-kit.spec.ts — "dev kit"

- **screenshots shared patterns in light and dark**: `/dev/kit` shows
  `[dev-kit]`, `[kit-status-succeeded]`, `[kit-impact-read]`,
  `[kit-freshness-fresh]`, `[kit-confirmation]`, `[kit-plan]`,
  `[kit-parts]`, `[kit-checkbox]`, `[kit-combobox]`, `[kit-accordion]`,
  `[kit-file-tree]`, `[kit-prompt-input]`, `[kit-stack-trace]`,
  `[kit-terminal]`, `[kit-env]`; screenshot `dev-kit-light.png`; press `d`
  → html `/dark/`; `dev-kit-dark.png`.

### docket.spec.ts — "docket (DES-044)"

- **board**: `[docket-card-fix-login]`, `[docket-column-doing]`,
  `[docket-empty-done]` visible; `screenshotThemes("docket-page")`.
- **new card**: open `[docket-new-card-open]`; fill title
  (`uniqueTitle()`), ref `https://github.com/costory/flows/issues/216`,
  `#nc-body` `E2E new card body.`; submit; `[docket-panel]` and
  `[docket-card-<slug>]` visible.
- **add to column**: `[docket-add-review]` opens the dialog; its
  `combobox` → option "Review"; fill title; submit; card appears inside
  `[docket-column-review]`.
- **drag move**: `refactor-auth` is in `[docket-column-todo]`; drag card
  to `[docket-column-doing]` → that column contains `Refactor auth
session`; drag back to todo.
- **columns**: `[docket-columns-open]` → `[docket-columns]`; in
  `[columns-row-todo]` the control labelled `Tone` → option "Working";
  `[docket-columns-save]`; dialog hidden.
- **open panel**: click fix-login → panel contains `Fix flaky login`;
  Escape → panel count 0.
- **edit title body**: `createCard(title, { body: "Before edit." })`;
  in panel, `Edit title` → field labelled `title` → fill
  `<title>-renamed` + Enter; `Edit description` → `description` → `After
edit.` + `ControlOrMeta+Enter`; board card (old slug id) shows the new
  title; `Edit description` shows `After edit.`.
- **delete card**: create card; button "Card actions" →
  `[docket-delete]` → `[confirm-ok]`; panel and card gone.

### docket-panel.spec.ts

"docket card panel sections (BL-198)" (all on fix-login):

- **add ref**: button "Add ref"; fill `[docket-ref-url]`
  `https://github.com/costory/flows/issues/198`; `[docket-ref-add]`;
  text `github` (exact) and link named
  `github.com/costory/flows/issues/198` visible; button `Remove ref
github.com/costory/flows/issues/198` removes the link.
- **properties**: `[docket-prop-status]` → option "Review" → board
  `[docket-column-review]` contains `Fix flaky login`; `Edit start date`
  → field `start date` fill `2026-11-21` + Enter → shows `Nov 21, 2026`;
  "Add property" → `[docket-prop-name]` `assignee`, `[docket-prop-value]`
  `dbx`, `[docket-prop-add]` → `Edit assignee` shows `dbx`; edit via
  textbox `assignee` to `flows` + Enter; button `Remove property
assignee` removes it.
- **add link**: "Add link" → `[docket-link-rel]` option "blocks" →
  `[docket-link-target]` option "Refactor auth session" →
  `[docket-link-add]`; both texts visible; button `Remove link to
Refactor auth session` → text `No links yet`.

"docket card panel assets (BL-199)":

- **add asset**: `Acceptance criteria` visible, one `[asset-open-menu]`;
  "Add asset" → `[asset-add-from-disk]` → `[asset-disk-dialog]`; set
  `[disk-file-input]` to `notes.md` (`text/markdown`, `# Notes\n`);
  `[disk-picker]` contains `notes.md`; `[asset-disk-submit]`; dialog
  hidden; `notes.md` visible; 2 menus; open the 2nd →
  `[asset-remove]` → back to 1 menu and acceptance still there.
- **item files**: `[item-open-menu]` → `[item-view-files]` → URL
  `/files`, `[files-page]`.
- **ref data**: `[ref-data-block]` shows `rally` (exact), `US1234`, `In
progress`, `Sprint 42`.

### docket-runs.spec.ts — "docket card runs (BL-200)"

- **run dialog**: `[card-run-open]` → `[card-run-dialog]`;
  `[card-run-workflow]` → option `/node start run/i`;
  `[card-run-input-ticket]` visible with value `US1234` (prefilled from
  the card's first ref id); button "Cancel" closes.
- **card runs**: panel shows `No runs yet`; start `diamond` via
  `[card-run-start]`; `[runs-sheet]` visible (15 s) with `data-run-id`;
  panel `[card-run-row-<runId>]` visible (15 s); Escape closes sheet;
  clicking the row reopens `[runs-sheet]`.
- **run on card** (60 s): start `card slow`; sheet + `[runs-cancel]`
  (15 s); cancel → `[confirm-dialog]` button "Cancel run";
  `[runs-rerun]` visible; rerun → sheet `data-run-id` changes (15 s) and
  new `[card-run-row-<id>]`; cancel again; "Close" in sheet → sheet gone
  (5 s); start `diamond` again → `[runs-rerun]` visible (20 s).

### files.spec.ts — "files page"

`openBoardYaml`: `/files`, `[files-search]` fill `board.yaml`, click
`[out-file-docket/board.yaml]` (FileTree testid), `[files-preview]`.

- **tree**: `[files-count]` not `0 files`; `[files-tree]`; search shows
  board.yaml; `screenshotThemes("files-tree")`.
- **edit save**: `[files-editor]` contains `version: 1`; append `\n# e2e
edit\n`; `[files-save]` → becomes disabled; reload → content persisted;
  restore original and save.
- **reveal**: delete `window.__FLOWS_LAST_REVEAL__`; `[files-reveal]`;
  poll until it contains `docket/board.yaml` and starts with
  `FLOWAPP_HOME` (the web build records the last reveal path there when
  not in Electron).
- **stat**: `[files-stat]` contains `YAML` and a size matching
  `/\d+(\.\d+)?\s*(B|KB|MB)/`.

### inbox.spec.ts — "inbox (DES-044)"

Helpers: `openInboxItems()` = `inbox/list` filtered `status === "open"`;
`dismissAllOpenInbox()`; `waitForItem(pred, 20 s)` polls.

- **empty**: dismiss all; `/inbox` shows `[inbox-page]` and
  `[inbox-empty]`.
- **approval**: cancel live + start `node-approval-home`; item id is
  exactly `approval:<runId>:gate:1`; `[inbox-item-<id>]` (20 s) contains
  `Ship the change?`; `[inbox-approve-<id>]` → gone (15 s).
- **permission**: `agent-acp-ask`; wait for `kind === "permission" &&
runId === runId`; `[inbox-allow-once-<id>]` → gone.
- **question**: `agent-acp-question`; kind `question`;
  `[inbox-qopt-<id>-q1-plan]` then `[inbox-answer-<id>]` → gone.
- **plan review**: `agent-acp-plan`; kind `plan_review`; item contains
  `E2E plan`; `[inbox-accept-<id>]` → gone.
- **dismiss**: approval item; `[inbox-dismiss-<id>]` → gone.

### layout.spec.ts — "layout check (BL-061 / BL-216)"

`test.use({ viewport: { width: 1440, height: 900 } })`. For each theme
(`light`, `dark`) × route, test `"<name> (<theme>)"`:

1. `addInitScript` sets `localStorage.theme = theme`; goto path; run
   `prepare`; expect `[ready]` (first, 30 s); `<html>` class matches the
   theme.
2. Unless route is `settings`, `expectLayout`: first `header` height 48;
   first `h1` visible, x polls to 280, font-size `20px`; content
   `[class~="@container/main"]` `padding-top: 24px`; each direct child
   without `data-bleed` has x 280; every `[data-slot=button|input|select-trigger]`
   not inside the DENSE selector (`[data-slot=table-cell]`,
   `[data-slot=table-head]`, `[data-slot=item-actions]`,
   `[data-slot=input-group]`, `[data-slot=sidebar]`, `[data-sidebar]`,
   `[data-slot=code-block]`, `[data-testid=graph-canvas]`,
   `[data-testid=canvas]`, `[data-slot=prompt-input]`, `[role=dialog]`,
   `.react-flow__node`), not having class `underline-offset-4`, and with
   non-zero height, is 32 px tall.
3. `toHaveScreenshot("<name>-<theme>.png", { maxDiffPixelRatio: 0.01,
mask: [time, [id-text], [run-took]], clip: { x: 256, y: 48, width:
1184, height: dynamic ? (clipHeight ?? 160) : 852 } })`.

| name              | path                 | ready                        | clipHeight | prepare                                                                         |
| ----------------- | -------------------- | ---------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `docket`          | `/docket`            | `docket-page`                | 220        | click fix-login card, panel visible                                             |
| `inbox`           | `/inbox`             | `inbox-page`                 | 160        | —                                                                               |
| `workflows`       | `/workflows`         | `workflows-new-open`         | 160        | —                                                                               |
| `workflow-editor` | `/workflows/diamond` | `workflow-editor-tab-canvas` | 220        | `workflow-canvas` visible, click `workflow-canvas-fit`                          |
| `connectors`      | `/connectors`        | `connector-add-open`         | 220        | open github-cli sheet                                                           |
| `library`         | `/library`           | `library-search`             | 220        | click `.font-medium` in `library-row-github-acme-demo`, `library-sheet` visible |
| `skills`          | `/skills`            | `skills-installed`           | 220        | click available tab (assert `aria-selected=true`), then installed tab           |
| `files`           | `/files`             | `files-tree`                 | 160        | —                                                                               |
| `settings`        | `/docket`            | `settings-panel`             | 280        | `docket-page` visible, click `settings-open`, panel visible                     |

All routes are `dynamic: true`, so only the top strip is compared. 18
baselines are committed (darwin chromium).

### library.spec.ts — "library page"

`openItem(id)` clicks the first `.font-medium` inside
`[library-row-<id>]` (tag badges would filter instead).

- **providers**: `[library-providers-open]` → `[providers-dialog]` with
  `[provider-github]`, `[provider-confluence]`, `[provider-rally]`;
  `[provider-add-open]` → `[provider-form]`; fill `#pv-name` Grafana,
  `#pv-pattern` `grafana[^/]*/d/(?<id>[^/]+)`, `#pv-files`
  `dashboard.json`, `#pv-fetch` `Grafana API`; `[provider-add-submit]` →
  `[provider-grafana]` and `[library-kind-grafana]`.
- **list**: rows `github-acme-demo`, `local-notes`;
  `[library-view-gallery]` → `[library-tile-github-acme-demo]`;
  `screenshotThemes("library-list")`.
- **sheet**: open acme → `[library-sheet]`, `[library-remote]`,
  `[library-files]`; `[library-tab-versions]` → `[library-versions]`,
  `[library-version-1]`, `[library-version-2]`; screenshots.
- **pin**: version 2 shows `Current`; `[library-pin-1]` → version 1
  `Current`, `[library-pin-2]` visible.
- **remote**: `[library-fetch]` visible; count versions; click fetch →
  label back to `Fetch` (15 s), versions +1; `[library-menu]` →
  `[library-push]` → `Fetch` again, versions +2; menu → `[library-unlink]`
  → `[library-remote]` contains `Only on this machine`.
- **chrome**: `[library-search]`, `[library-kind-github]`; search
  `Scratch` shows only local-notes; gallery → `[library-gallery]`.
- **add**: `[library-add-open]` → `[library-add]`;
  `[library-add-tab-disk]`; `[disk-file-input]` `notes.md`; `#lib-title`
  `Disk notes`, `#lib-tags` `type:import`; `[library-add-submit]` →
  `[library-sheet]` (10 s), row `library-row-disk-notes`.
- **detect**: `[library-link-url]` `https://github.com/acme/fresh-repo`
  → `[library-detected]` contains `GitHub` and `acme/fresh-repo`.
- **disk pick**: disk tab shows `[disk-picker]`, `[disk-choose-file]`,
  `[disk-choose-folder]`; set `pick-me.md` → picker shows it.
- **tags**: `[library-tag-rail]` click text `notes` →
  `[library-active-tags]`, only local-notes; open local-notes →
  `[library-tab-details]` → `[library-tag-input]` `epic:EP7` → button
  "Add" → `[library-tag-editor]` contains `EP7`.
- **remove**: local-notes → `[library-menu]` → `[library-remove]` →
  `[confirm-dialog]` → `[confirm-ok]` → row gone, acme stays.

### runs.spec.ts

- describe "runs.spec.ts › page gone" / **page gone**: `/runs` has no
  `[runs-page]` / `[runs-start-open]`; on `/docket` `[app-sidebar]` has
  no link "Runs".
- describe "runs.spec.ts › sheet in context" / **sheet in context**:
  cancel live `sheet-delete-demo`; from fix-login start option `/sheet
delete demo/i`; `[runs-sheet]` (15 s) with run id; card row visible;
  `[runs-rerun]` (20 s, i.e. finished); `[runs-menu]` → `[runs-delete]`
  → `[confirm-dialog]` button "Delete run" → sheet and row gone.

### shell-smoke.spec.ts — "shell smoke (BL-185 / BL-216)"

- **`<path>` loads without page errors** for `/docket` (`docket-page`),
  `/inbox`, `/workflows` (`workflows-page`), `/connectors`, `/library`,
  `/skills`, `/files`, `/brand` (`<name>-page`): collect `pageerror`s,
  wait for ready (30 s), assert none other than messages matching
  `/cannot contain a nested|ValidateDOMNesting/i`.
- **nav**: `[app-sidebar]` (30 s) has links Docket, Workflows, Inbox,
  Files, Library, Skills, Connectors.
- **inbox badge**: cancel live `node-approval-home`; read
  `[inbox-badge]` number; start the workflow; poll (20 s) until the badge
  number is greater.
- **app names**: on `/docket` no element with `data-testid^='mock-'`.
- **no runs nav**: no "Runs" link; "Docket" link visible.
- **no mock routes**: `/mock/docket` renders neither `[app-sidebar]` nor
  `[docket-page]`.

### sidebar-settings.spec.ts — "sidebar settings panel (BL-210)"

`openSettings`: `/docket`, `[app-sidebar]` (30 s), `[settings-open]` →
`[settings-panel]`.

- **panel**: visible and URL does not match `/settings`.
- **theme**: `[theme-shortcut-hint]` contains `d` and its `kbd` text is
  `d`; in `[theme-toggle]` click text "Dark" → html `/dark/`
  (screenshot `settings-dark.png`); "Light" → `/light/`
  (`settings-light.png`).
- **text size**: `[text-size-large]` → `document.documentElement.style
.fontSize === "112.5%"`; persists across reload; after reopening,
  `[text-size-large]` has `aria-pressed="true"`; `[text-size-default]` →
  `100%`.
- **cli trust**: `[cli-status-list]` (30 s), `[cli-claude]`,
  `[cli-cursor]`.
- **always trust**: `[trust-settings]` (30 s); `[trust-always]` →
  `[trust-revoke]` → click → `[trust-always]` back.
- **mcp trust**: FCP `settings/set_mcp_trust { key: "npx e2e-mcp",
grant: "always" }`; `[mcp-trust-list]` (30 s), `[mcp-trust-row]`
  contains `npx e2e-mcp`; `[mcp-trust-revoke]` → `[mcp-trust-empty]`.
- **no route**: `/settings` renders none of `[app-sidebar]`,
  `[docket-page]`, `[settings-page]`, `[settings-panel]`.

### skills.spec.ts — "skills page"

- **installed**: rows `[skill-row-workspace-write-tests]`,
  `[skill-row-workspace-commit-style]`; `screenshotThemes("skills-page")`;
  open write-tests → `[skill-sheet]`, `[skill-body]` contains
  `write-tests`; Escape.
- **tabs**: `[skills-tab-available]` text `Available (2)`,
  `[skills-tab-sources]` `Sources (1)`; tabs show `[skills-available]`,
  `[skill-sources]`, `[skill-source-repo-team-skills]`.
- **used by**: write-tests sheet shows `[skill-used-by]` and
  `[skill-used-skill-uses-write-tests-draft]` (`<workflowId>-<nodeId>`).
- **update**: write-tests row contains `Update available`; sheet
  `[skill-update]` → disappears; body contains `Cover the edge`.
- **install**: available tab → `[skill-available-review-pr]` →
  `[skill-install]` → `[skill-uninstall]`; Escape closes sheet; installed
  tab shows `[skill-row-workspace-review-pr]`.
- **sources**: `[skill-sync-repo-team-skills]` → text back to `Sync`
  (15 s); `[skill-source-remove-repo-team-skills]` → source row gone;
  `[skill-source-open]` → `[skill-source-add]` →
  `[skill-source-pick-repo-team-skills]` → `[skill-source-submit]` → row
  back.
- **uninstall**: write-tests sheet → `[skill-uninstall]` → row gone,
  commit-style remains.

### workflows.spec.ts

"workflows page (BL-179 / BL-216)":

- **list**: `[workflows-page]`, `[workflows-new-open]`,
  `[workflow-diamond]`, `[workflows-search]`;
  `screenshotThemes("workflows-page")`.
- **new**: `[workflows-new]` dialog; `[workflows-new-name]` `Ship wf
<stamp>`; `[workflows-new-submit]` → `[workflow-editor]`;
  `[workflow-editor-tab-yaml]` → `[workflow-editor-yaml]` contains
  `ship-wf-` (id is the slug).
- **open editor**: click `[workflow-diamond]` → `[workflow-sheet]` →
  `[workflow-open-editor]` → `[workflow-editor]`, `[workflow-canvas]`;
  screenshots.
- **rename delete**: create `Rename me <stamp>`; back on list, row
  `workflow-rename-me-*`; button `Actions for <name>` → menuitem
  "Rename" → same `[workflows-new]` dialog → `Renamed <stamp>` → button
  `Actions for Renamed <stamp>` (10 s) → menuitem "Delete" →
  `[confirm-ok]` → row with original id gone (10 s).

`saveAndWait`: `[workflow-editor-save]` enabled → click → text `Save` and
disabled.

- "workflows.spec.ts › editor yaml": diamond yaml tab contains `id:
diamond`; insert `# keep me\n` before `goal: e2e node run`; save; file
  on disk contains both (comments survive).
- "… › canvas": nodes `[canvas-node-trigger]`, `[canvas-node-command]`,
  `[canvas-node-output]`; fit; drag command header (+120, +40 via mouse,
  8 steps); save; `workflow.layout.json` `nodes.build` exists and moved
  from (420,80).
- "… › add node": `[flow-add-node]` → `[flow-add-node-search]` `llm` →
  `[flow-add-kind-llm]` → `[canvas-node-llm]`; save; yaml has `kind:
llm`.
- "… › node settings": `/workflows/node-settings-e2e`; fit; click
  command node; DOM-click `[node-open-settings]`; `[node-settings]`;
  `[node-settings-timeout]` → option "30 min"; `[node-settings-retry]` →
  "2 retries"; save; yaml matches `/timeout:\s*1800/` and `/max:\s*2/`.
- "… › undo redo": add approval via `[flow-add-kind-approval]` →
  `[canvas-node-approval]`; `[workflow-canvas-undo]` enabled (5 s) →
  node gone; `[workflow-canvas-redo]` → back.
- "… › canvas edit" / **trigger has no settings; edit, wire and notify
  inline**: on canvas-edit-e2e, selecting the trigger shows no
  `[node-open-settings]`; llm node `[node-field-prompt]` has value `Plan
it.\n`, fill `Plan the ticket.` and blur; drag the trigger's handle
  `.react-flow__handle[data-handleid="text"]` to the llm's
  `.react-flow__handle-left[data-handleid="text"]`; click
  `[output-channel-system]`; save; yaml contains `{ from: start, to:
plan }` and `channel: system`; `nodes/plan/prompt.md` polls to `Plan
the ticket.`.
- "… › step connectors": node-canvas; `[canvas-node-agent]`; fit;
  `[step-connectors]` → `[node-settings]`; `[pick-Connectors] input`
  `github` → `[pick-item-github-cli]`; `[pick-Skills] input` `commit` →
  `[pick-item-commit-style]`; save; yaml contains `github-cli` and
  `commit-style`.
- "… › model row": `/workflows/node-llm-light` `[model-row]`;
  `[model-row-cli]` → option "Cursor"; save; yaml has `cli: cursor`.
- "… › node actions": diamond; fit; click text "Command" in the command
  node; DOM-click `[node-duplicate]` → 2 command nodes; DOM-click
  `[node-delete]` → 1.
- "… › validate" / **blocks save when yaml is invalid**: yaml `id:
diamond\nnodes: [{ id: x, kind: nope }]\n`; save →
  `[workflow-editor-validation]` visible.

### workflows-canvas.spec.ts

- "workflows-canvas.spec.ts › drag collision" / **dropping a node onto
  another pushes them apart**: diamond, fit; mouse-drag the output node
  header onto the command node header (12 steps); poll that the output
  node moved and that the two bounding boxes no longer overlap.

### workflows-run.spec.ts

"workflows.spec.ts › canvas run bar":

- **canvas run bar**: diamond `[flow-run-bar]`; `[flow-run-card]` →
  option `/Fix flaky login/i`; `[flow-start-run]` enabled → click;
  `[flow-run-banner]` (20 s), `[flow-run-select]`, command node visible.
- **offers Retry on a failed node** (90 s): start
  `node-run-fail-light`, poll `run/get` until `failed` (45 s); goto
  `/workflows/node-run-fail-light?run=<id>`; banner contains `/Failed/i`
  (15 s); `[node-retry-build]` force-click; banner visible.
- **node logs button and popup** (90 s): same failed run; exactly one
  `[node-logs-*]` (`node-logs-build`; trigger/output have none); for
  viewports 1280×800 and 375×700: click → `[node-log-dialog]`,
  `[node-log-terminal]` contains `echo broken` and `broken`, first
  `[node-log-entries] > li` has a `time`; dialog box fits inside the
  viewport width; Escape closes.

"workflows-run.spec.ts › canvas inbox ask":

- **approval ask on the node resumes the run** (90 s): start
  `node-approval-light`; open with `?run=`; `[canvas-node-approval]`;
  `[node-inbox-gate]` contains `Ship the change?` (20 s);
  `[node-inbox-approved-gate]` → prompt gone; `run/get` → `succeeded`
  (45 s).

### workflows-sheet.spec.ts

- "workflows.spec.ts › sheet" / **sheet**: diamond row →
  `[workflow-sheet]`, `[workflow-open-editor]`, `[sheet-inputs]`,
  `[workflow-start]`.
- "… › sheet inputs": `[workflow-node-start-run]` sheet inputs contain
  `ticket`; `[trigger-input-draft]` `repo` → `[trigger-input-add]` →
  contains `repo`; Escape and reopen → still `repo` (saved).
- "… › sheet runs": cancel live diamond; sheet `[sheet-start-card]` →
  option `/Fix flaky login/i` → `[workflow-start]` → `[workflow-editor]`
  and `[flow-run-banner]` (15 s); back to list, open diamond →
  `[sheet-runs-list]` (15 s).
- "… › sheet start": same start → `[flow-run-bar]` (15 s), banner (20 s),
  URL matches `/run=/`.

## Test-title contract (DES-044)

`packages/docs-tools/src/des044-e2e-ids.ts` checks that every `app` /
`drop` row of `docs/designs/des-044-mock-parity-checklist.md` names an
existing `test("…")` title in `apps/e2e/tests/<file>.spec.ts` (format
`<file>.spec.ts › <title>`). The describe titles like
`"workflows.spec.ts › sheet"` mirror that format; keep test titles
stable. See [../packages/docs-tools.md](../packages/docs-tools.md).

## Order dependence and shared state

One worker, one shared home, so specs mutate each other's data: diamond
gains nodes, comments and layout moves; skills tests install/uninstall;
`write-tests` may be uninstalled before `workflows.spec.ts › step
connectors` runs (hence it picks `commit-style`). Tests that start runs
first call `cancelLiveRuns` to avoid the per-workflow concurrency cap.
Layout baselines clip to the top strip because list contents vary.
