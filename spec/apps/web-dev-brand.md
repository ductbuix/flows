# apps/web — Brand (`/brand`, `/brand/:mockupId`) and Dev kit (`/dev/kit`)

Part of the [web spec](web.md). Reference pages for agents and designers;
not product pages and not in the sidebar. Files: `src/pages/brand/*`
(16 source files) and `src/pages/DevKitPage.tsx`. No FCP calls.

## Brand registry

### types.ts

```ts
export type MockupGroup = "Foundations" | "Work items" | "Workflows"
export type Mockup = {
  id: string
  title: string
  group: MockupGroup
  summary: string
  usedIn: string[]
  anatomy: string[]
  states: string[]
  rules: { do: string[]; dont: string[] }
  parts: string[]
  Component: ComponentType
}
```

### registry.ts

`MOCKUPS` in display order: `status`, `create-form`, `kanban`, `canvas`,
`run-card`, `node-ask`, `node-logs`, `detail-panel`.
`findMockup(id: string | undefined): Mockup | undefined`.
Re-exports `Mockup`, `MockupGroup`.

## BrandPage (`/brand`)

`<Page crumbs=[{label:"Brand"}] data-testid="brand-page">`:

- `PageTitle title="Brand" description="Mockups and rules for the Flows UI. Open one to see it live with its rules. DESIGN.md holds the full guide."`
- One `PageSection` per group in order Foundations, Work items, Workflows (skip empty).
- Grid `grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4` (container queries on the Page's `@container/main`).
- Each card: `Link to=/brand/<id> data-testid="brand-card-<id>"` (`group flex h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50`) wrapping `Card className="w-full flex-1 pt-0"`:
  - Thumbnail `div aria-hidden` `pointer-events-none flex h-28 shrink-0 items-start justify-center overflow-hidden border-b bg-muted/60 bg-dot-grid p-2` containing the live mockup component inside `div.origin-top.scale-50`.
  - `CardHeader.flex-1`: `CardTitle` title, `CardDescription.line-clamp-2` summary, `CardAction` with `ChevronRight size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5`.

## BrandMockupPage (`/brand/:mockupId`)

- Crumbs `[{label:"Brand", to:"/brand"}, {label: title ?? "Not found"}]`.
- Unknown id: `Page` (no testid) with `Empty`: **No mockup named <id>** / **Pick one from the Brand page.**
- Known: `<Page data-testid="brand-mockup-<id>">`:
  - `PageTitle title description=summary badge=<Badge secondary>{group}</Badge>`.
  - Stage: `div data-bleed data-testid="brand-stage"` `flex min-h-96 shrink-0 items-center justify-center border-y bg-muted/60 bg-dot-grid px-4 py-12` with `<Component/>` (full width via the Page's `data-bleed` rule).
  - Grid `grid gap-8 @4xl/main:grid-cols-2` of `PageSection`s: **Anatomy** (ordered list), **States** (bullets), **Do** (each line with `Check` `mt-0.5 size-4 shrink-0 text-success`), **Don't** (`X` `text-destructive`), **Build from** (mono list of `parts`), **Used in** (bullets). Lists use `flex list-decimal|list-disc flex-col gap-1.5 pl-5 text-sm`; rule lists `flex flex-col gap-2 text-sm` with `li.flex.gap-2`.

## Mockups

All under `src/pages/brand/mockups/`. Each exports a component and a
`Mockup` spec. The spec text below is the exact content shown on the page.

### status — Status pill (Foundations) — `StatusMockup.tsx`

Visual: `div.flex.flex-wrap.items-center.gap-3 data-testid="mockup-status"` with `StatusPill` per tone, `data-testid="pill-<tone>"`: working **3 working**, done **Done**, failed **Failed**, attention **Needs sign-in**, idle **Queued**.

- summary: One tinted pill tells the state of a run, step or connection.
- usedIn: Kanban card; Run card header; Workflow detail panel
- anatomy: Icon or pulse dot; Sentence-case label (1–3 words)
- states: working: info tone, pulsing dot, count when useful (3 working) / done: success tone, check / failed: destructive tone, cross / attention: warning icon on neutral text (Needs sign-in, Needs you) / idle: muted (Queued, Draft, Off)
- do: Use StatusPill; tones come from TONE_CLASS only / Say what is true now in plain words: Done, Failed, Needs sign-in / Put it at the right end of a header or row
- dont: Raw enum labels (succeeded, cancelled) in the UI / Two pills on one row / Palette colors (text-green-600); use success / info / warning
- parts: components/brand/StatusPill; ui Badge

### create-form — Create form (Foundations) — `CreateFormMockup.tsx`

Visual: `Card w-full max-w-xl data-testid="mockup-create-form"`. Header `flex items-center gap-2`: ghost icon **Back** (`ArrowLeft`) + Breadcrumb **Workflows › New workflow** (link `#`). Content `FieldGroup`:

- **Name**: `InputGroup` with `Workflow` addon, `InputGroupInput#brand-name defaultValue="Release check"`.
- **What should it do?**: `Textarea#brand-goal rows=3`, initial **Before each release, compare open PRs with the spec, check tests and draft the notes.**; description **One or two sentences. Flows drafts the nodes from this.**
- **Start from an example**: `Suggestions` with `Suggestion`s **Check a release before it ships**, **Triage new bugs every morning** (click fills goal).
- **It can use**: `ToggleGroup multiple variant="outline"` GitHub / Rally / Confluence (GitHub on).
- Footer `justify-end gap-2`: ghost **Cancel**, primary **Create workflow**.

Spec:

- summary: Make something new from a plain sentence: name, goal, examples, what it can use.
- usedIn: New workflow; New work item; Start run inputs
- anatomy: CardHeader: back Button + ui Breadcrumb (Workflows › New workflow) / Name: InputGroup with an icon InputGroupAddon / Question-style label for the goal (What should it do?) and a Textarea / Examples: ui Suggestions; clicking one fills the goal / It can use: ToggleGroup multiple, variant=outline / CardFooter: Cancel (ghost) and one primary action named for the result
- states: Empty: placeholders show a real example, not 'Enter text' / Invalid: FieldError under the field, primary stays enabled / Saving: primary shows a Spinner and keeps its label
- do: Ask questions in labels: What should it do? / Name the button for what it makes: Create workflow / Build from Card, Breadcrumb, Field, InputGroup, Textarea, ToggleGroup, Suggestion
- dont: YAML, ids or file paths in a create form / More than five fields; push advanced settings to the detail panel / Submit or OK as button text
- parts: ui Field, FieldGroup, FieldLabel, FieldDescription / ui Card, Breadcrumb, InputGroup, Textarea, ToggleGroup, Button / ui Suggestions / Suggestion

### kanban — Work items board (Work items) — `KanbanMockup.tsx`, `kanban-data.ts`

Visual: `div.flex.w-full.max-w-5xl.gap-3.overflow-x-auto.pb-2 data-testid="mockup-kanban"`. Lane `flex w-64 shrink-0 flex-col gap-2 rounded-2xl bg-muted p-2 dark:bg-card`; header `flex items-center gap-2 px-1.5 pt-1`: `text-sm font-medium` title, `Badge secondary` count, spacer, ghost icon `Plus` `aria-label="Add to <title>"`. Card `Item variant="outline"` `cursor-grab bg-background` (+ `ring-warning/50` for attention), `data-testid="kanban-card"`: title, description = source, `ItemFooter` with xs muted workflow + `StatusPill`.

Data:

| Lane      | Cards (title · source · workflow · pill)                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inbox     | Fix flaky login test · Rally US1234 · 2h ago; Summarize Q4 support tickets · Ad hoc · yesterday                                                                     |
| Running   | Release 2.4 readiness · Rally US1201 · 10m ago · Release check · working "Step 2 of 4"; Update onboarding docs · Library · 1h ago · Docs refresh · failed "Failed"  |
| Needs you | Publish API changelog · Ad hoc · 30m ago · Changelog · attention "Approve publish"; Weekly analytics digest · Schedule · today · Digest · attention "Needs sign-in" |
| Done      | Triage open bugs · Rally US1188 · Mon · Bug triage · done "Done"                                                                                                    |

Spec:

- summary: The Work items page: a Kanban board with Inbox, Running, Needs you and Done.
- usedIn: /docket (the page itself)
- anatomy: Page header: title, one line, New work item button / Lane: muted rounded-2xl column (no shadcn part), name, count Badge, ghost + Button / Card: Item variant=outline (ring-only): ItemTitle, ItemDescription (source line), ItemFooter with workflow + status pill
- states: Inbox: no workflow yet, no pill / Running: info pill with the live step (Step 2 of 4) / Needs you: warning ring + attention pill (Approve publish, Needs sign-in) / Done: success pill; Failed stays in Running with a failed pill / Empty column: lane stays, a muted line says what lands here
- do: Column is derived from the latest run; drag only between Inbox and Done / Open the item in a right Sheet on click; keep the board in view / Fixed lane width (w-64), board scrolls sideways / One status pill per card, at the bottom right
- dont: Tables for work items on this page / Ids, paths or timestamps in ISO form on cards / More than three lines of text on a card
- parts: ui Item (Content, Title, Description, Footer), ui Badge / components/brand/StatusPill / ui Button ghost icon, ui Sheet for the item detail

### canvas — Workflow canvas (Workflows) — `CanvasMockup.tsx`, `CanvasNode.tsx`

Helpers (`CanvasNode.tsx`):

- `CanvasNode({icon, kind="soft", title, subtitle, inset?, selected?, className?})`: `Card size="sm"` `w-72` (+ `ring-2 ring-info/40` selected), `data-testid="canvas-node"`; header `flex items-center gap-2.5` with `KindAvatar size="sm"`, truncated `CardTitle` and xs `CardDescription`; optional content inset `rounded-lg bg-muted p-3`.
- `EdgeLabel({tone="muted"})`: `Badge outline bg-background` + tone tint (`info`, `success`, `destructive` with `/25` border, `/10` bg, full text).
- `Wire({className})`: `span.h-8.w-px.bg-border`.

Visual: `div.relative.flex.w-full.max-w-3xl.flex-col.items-center.rounded-2xl.bg-background.bg-dot-grid.px-4.pt-8.pb-20.ring-1.ring-foreground/10 data-testid="mockup-canvas"`:

1. EdgeLabel **When this happens** + node (`Zap`, info) **New Rally story** / **Starts at once**, inset xs muted **INPUT** over **Stories tagged release in project Flows**.
2. Wire; EdgeLabel info **Do this** + selected node (`Bot`) **Draft the change** / **Claude Code · high effort**, inset **Read the story, change the code, open a draft PR.**
3. Wire; node (`ShieldCheck`, warning) **Review the diff** / **Judge · passes when tests are green**.
4. Wire `h-4`; elbow `div.h-4.w-80.rounded-t-xl.border-x.border-t`; two columns `gap-6`: success **Pass** + (`Send`, success, `w-56`) **Publish the PR** / **Needs your approval**; destructive **Fail** + (`RotateCcw`, `w-56`) **Back to Draft** / **Loops at most 3 times**.
5. Floating toolbar `absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-background p-1 ring-1 ring-foreground/10`: `ToggleGroup` Outline/Details (Outline on) + `ButtonGroup` (ghost icon **Zoom out** `Minus`, `ButtonGroupText` **100%**, **Zoom in** `Plus`, **Fit view** `Maximize2`).

Spec:

- summary: The Workflows page editor: nodes top to bottom on a dot grid, labeled edges.
- usedIn: /workflows/:id Editor tab; Past run canvas (read only)
- anatomy: Dot grid backdrop (bg-dot-grid) on bg-background / Edge label: ui Badge outline above the first node (When this happens) and actions (Do this) / Node: ui Card size=sm with KindAvatar, CardTitle, CardDescription, optional muted inset / Branches: elbow split, each branch topped by its label (Pass / Fail) / Floating toolbar bottom center (ring-only, flat): Outline/Details, zoom, fit
- states: Selected: ring-info/40; the detail panel opens on the right / Running (run view): the node tile turns into a spinner, wire in info / Done / failed: the node gets a status pill in its header / Needs you: warning tile + attention pill on the node
- do: Flow runs top to bottom; branches spread sideways / Name nodes with a verb phrase: Draft the change, Review the diff / Avatar tint = node kind: trigger info, approval/judge warning, output success, others soft / Edge labels say the condition in one or two words
- dont: More than one line of muted text under a node name / Colored wires except while a run is live / Settings forms inside nodes; they live in the right panel
- parts: @xyflow/react for the real canvas (Controls, Panel, Background); nodes/NodeFrame / ui Card size=sm, ui Badge, ui Avatar via components/brand/KindAvatar / ui ToggleGroup, ButtonGroup, Button ghost icon

### run-card — Run card (Workflows) — `RunCardMockup.tsx`, `run-card-data.tsx`

Visual: `Card className="w-full max-w-xl bg-muted" data-testid="mockup-run-card"`, local `done` toggle.

- Header: `KindAvatar kind="solid" size="lg"` (`ScanSearch`), **Release check** / **3 agents in parallel**; action pill working **3 working** or done **Done**.
- Inner `Card` → `CardContent.flex.flex-col.gap-4` → `Trace`: `TraceLine.text-foreground` (`CircleDot`) **Is release 2.4 ready to ship?**; `TraceLine` (`GitFork`) **Split into 3 parallel steps**; one `Task` per branch (`title`, `status`, `description`=duration, `steps`, `defaultOpen`).
- When done: answer block (`CircleCheck size-4 text-success` **Answer**), **Ship after two fixes:** and ordered list: Align PR 412 with the retry spec; Add the missing test for PR 418; Release notes are ready to publish.
- Footer `justify-between gap-4 bg-muted`: `StatRow` Time 4.4s/11.9s, Sources 8/15, Tokens 8.0k/17.6k; `Button size="pill"` **Stop** / **Run again** (toggles done).

Branches running: "Compare open PRs with the spec" 3.0s (Searching 4 repositories `Search`; Reading 6 files `FileText` running); "Check test coverage" 2.7s (Running the test suite `Search`; Rate limited, retrying — error); "Draft release notes" 2.4s (Collecting 5 merged changes `Search`; Grouping by label `Tag` running). All `status: "running"`.
Branches done: same titles, 4.7s "2 PRs drift from the spec"; 6.0s "Coverage 84%, up 2 points"; 4.3s "12 changes in 3 groups".

Spec:

- summary: A workflow run as a trace: question, split, parallel steps, answer, stats.
- usedIn: Workflow page Runs tab; Work item detail
- anatomy: Card (bg-muted) > CardHeader: KindAvatar solid, CardTitle, CardDescription, CardAction status pill / Inner Card: Trace with the input line and the split line / One AI Elements Task per branch: title, duration (TraceDescription), steps / Answer: check, heading, numbered points / CardFooter: StatRow (Time, Sources, Tokens) and one pill action
- states: Running: spinner icons and shimmering titles (TraceLine status=running) / Step error: TraceLine status=error turns the line red; the run keeps going / Done: check icons; each Task holds one result line; the chevron folds it
- do: Use Task / Trace for any list of agent steps; never draw connectors / Show the live action as a verb phrase: Searching 4 repositories / Keep one primary action in the footer: Stop while running
- dont: Log lines or raw ids in the trace / Custom spinners, elbows or tree lines / More than one filled button
- parts: ui Card (Header, Title, Description, Action, Content, Footer) / ui Task, ui Trace / ui Avatar via components/brand/KindAvatar / components/brand/StatusPill, StatRow; ui Button size=pill

### node-ask — Node ask (Workflows) — `NodeAskMockup.tsx`, `node-ask-data.ts`

Visual: `div.grid.w-full.max-w-xl.gap-4 data-testid="mockup-node-ask"`; per ask a `Card size="sm" data-testid="node-ask-<kind>"`: header with `KindAvatar soft sm` (approval `ShieldCheck`, permission `Wrench`, question `CircleHelp`), node name / subtitle, action `StatusPill attention` **Needs you**; content = an `Item variant="outline" size="sm"` `flex-col items-stretch bg-warning/15 ring-warning/25` (`node-ask-prompt-<kind>`) with the question, optional **Tool: <tool>**, and option buttons (first `ok` default with `Check`; `Reject*` with `X`) or a single **Answer in Inbox**. Same markup as `NodeInboxPrompt`.

Data: approval — **Publish release notes** / **Approval step waiting for you** / **Publish the release notes to the team channel?** / Approve, Reject. permission — **Run the build** / **Agent step asking to run a command** / **Allow the agent to run this command?** / tool **Shell: pnpm build** / Allow once, Always allow, Reject. question — **Pick a reviewer** / **Agent step with a question** / **Which reviewer should own the change?** / no options.

Spec:

- summary: An open ask sits on its canvas node and is answered in place, or in the Inbox.
- usedIn: Workflow canvas, node with an open ask
- anatomy: Node Card size=sm: KindAvatar, verb-phrase name, muted line, CardAction pill (Needs you) / Item variant=outline size=sm with the warning tint: question title, optional Tool: line / ItemActions: option buttons (approval: Approve, Reject; permission: Allow once, Always allow, Reject) or one Answer in Inbox button
- states: Approval: two options, Approve is the one filled button / Permission: three options, Allow once is filled, the tool named on its own line / Other kind: no buttons on the node; Answer in Inbox opens the Inbox / Answering: buttons disable until the answer lands; conflicts close quietly
- do: Answer approvals and permissions on the node so the canvas stays in view / Use the warning tint (bg-warning/15, ring-warning/25) for every ask / Send any other kind of question to the Inbox with one link
- dont: A form or free text on the node / More than one filled button / Hard-coded status colors instead of the warning tokens
- parts: ui Card size=sm (Header, Title, Description, Action, Content) / ui Item variant=outline size=sm (Content, Title, Description, Actions) / ui Button (default for the primary option, outline for the rest) / components/brand/KindAvatar, StatusPill (tone attention)

### node-logs — Node logs (Workflows) — `NodeLogsMockup.tsx`, `node-logs-data.ts`

Visual: `div.grid.w-full.max-w-4xl.gap-4.md:grid-cols-2 data-testid="mockup-node-logs"` of four `LogPanel`s (`Card size="sm" min-w-0 data-testid="node-logs-<id>"`, header **Build logs** / **Attempt 2**, action pill):

- `loading` (working **Loading**): `NodeLogLoading`.
- `entries` (done **3 steps**): `NodeLogEntries` with: message "Agent reply" (09:14:09Z) "The build passes. Release notes are ready to publish."; command "Run tests" `pnpm test` status `done` "42 passed in 3.1s" (09:14:06Z); tool_call "Read package.json" status `completed` `{ "name": "release-check" }` (09:14:02Z). Dates `2026-11-25`.
- `failed` (failed **Failed**): `StackTrace` error **Error: Build failed with exit code 2**, frames `at runBuild (scripts/build.ts:14:9)`, `at main (scripts/build.ts:31:3)`; `Output` of `> build\n> tsc --noEmit\n\nsrc/release.ts(12,7): error`.
- `empty` (idle **No output**): muted **No output yet.**

Reuses `NodeLogEntries`, `NodeLogLoading`, `Output` from the canvas.

Spec:

- summary: Logs of one node attempt, behind the node's Logs button in a right Sheet.
- usedIn: Workflow run view, node Logs button
- anatomy: Sheet (right): title = node name logs, description = Pass n and Attempt n / Pass chips when a node ran more than once (tabs; the latest is picked) / Ordered entries: Terminal for commands, Trace for tool calls and replies, StackTrace for errors / Stdout in Output when there are no entries; failure reason as StackTrace
- states: Loading: Skeleton rows in the shape of the entries / Entries: one row per command, tool call, reply or error, with its time / Failed: StackTrace headline and frames, then stdout / Empty: one sentence, No output yet.
- do: Open logs only from the node's Logs button, in a right Sheet / Show the result on the node; logs stay one click away / Fold long output inside its entry; show errors as a stack trace
- dont: A log panel under the canvas or on the node itself / Raw NDJSON, ids or paths in the entry list / Custom spinners or terminals instead of the parts
- parts: ui Sheet (SheetHeader, SheetTitle, SheetDescription) / ui Terminal, Trace (TraceCollapsible), StackTrace, Skeleton / canvas NodeLogEntries (entries, loading, Output) / components/brand/StatusPill

### detail-panel — Detail panel (Workflows) — `DetailPanelMockup.tsx`

Visual: `Card w-full max-w-sm data-testid="mockup-detail-panel"`:

- Header: `Field orientation="horizontal" className="w-fit"` with `Switch#brand-on` + label **On**/**Off**; `CardAction.flex.gap-1`: ghost **Edit** (`Pencil`), outline **Run now** (`Play`).
- Content `flex flex-col gap-4`: `ItemGroup.gap-0` of facts (`Item className="px-0 py-1.5"`, label in `ItemDescription`, value in `ItemActions`): **Next run** → `font-medium` **Fri 21 Nov, 17:00**; **Agent** → `Badge secondary` (`BarChart3 text-info`) **Data analyst**; **Posts to** → (`LayoutGrid`) **Portfolio launch**; **Uses** → (`Plug`) **Plausible** + `StatusPill attention` **Needs sign-in**. `Separator`. `FieldSet` + `FieldLegend variant="label"` **Notify me**, `FieldGroup.gap-3` of horizontal fields **When it finishes** (on) and **Only if it fails** (off) with `Switch`es (`font-normal` labels).
- Footer: ghost `text-muted-foreground` **Delete workflow** (`Trash2`).

Spec:

- summary: Right-hand panel for a workflow or node: actions, facts as rows, toggles, delete.
- usedIn: Workflow page right column; Node settings Sheet on the canvas; Work item Sheet from the board
- anatomy: Action row: on/off Switch left; Edit (ghost) and Run now (outline) right / Facts: ItemGroup of Item, ItemDescription label left, ItemActions value right; linked objects as Badge secondary / Problems sit inline next to the fact (Needs sign-in) / FieldSet + FieldLegend (Notify me) with Field orientation=horizontal Switch rows / CardFooter: Delete as a quiet ghost button
- states: Off: label reads Off, Next run reads Paused / Problem: attention pill next to the fact; clicking it fixes it (sign in) / Read only (past run): no Switches or actions, same rows
- do: Label left, value right, one fact per row / Switches apply at once; no Save button / Delete always asks in a ConfirmDialog
- dont: Forms with inputs for facts that are links (agent, target) / A red Delete button; destructive color only inside the confirm / More than three groups split by separators
- parts: ui Card (Header, Action, Content, Footer), Item, Badge / ui Field (FieldSet, FieldLegend, FieldLabel), Switch, Separator, Button / components/brand/StatusPill / components/ConfirmDialog for delete

## DevKitPage (`/dev/kit`, dev builds only)

Route is registered only when `import.meta.env.DEV`. Local state: `prompt`, `model`, `effort`.
`<Page crumbs=[{label:"Dev kit"}] data-testid="dev-kit">`:

- `PageTitle title="Shared patterns" description="Title block, status Badges, task Card, Confirmation and Plan." badge=<RunStatusBadge status="running" needsYou/>`.
- **Run status**: `RunStatusBadge` for queued/running/succeeded/failed/cancelled (`kit-status-<status>`) + needsYou (`kit-status-awaiting`).
- **Impact**: `ImpactBadge` read/local/cloud (`kit-impact-*`).
- **Freshness**: `FreshnessBadge` fresh/stale (`kit-freshness-fresh|stale`).
- **Publish policy**: `PublishPolicyBadge` read-only (`kit-policy-read-only`), approve-each-publish (`kit-policy-approve`), trust-agent-review (`kit-policy-agent-review`).
- **Task Card**: `Card max-w-sm` header mono **build** / **Command task**, action `RunStatusBadge running` (`kit-task-status`); content `Task title="build" status="running" data-testid="kit-task"` steps Install deps (no status), Compile (running).
- **Confirmation**: `Confirmation data-testid="kit-confirmation" title="Approve publish?" description="Reject leaves local changes unpublished."` (no-op handlers).
- **Plan**: `Plan data-testid="kit-plan" title="Run plan"` steps Fetch context (done), Apply workflow (running), Publish (pending).
- **shadcn parts** (`kit-parts`, `flex flex-wrap items-start gap-4`): Popover (outline trigger **Popover**), HoverCard (link trigger **Hover card**), Checkbox `kit-checkbox` + Label **Checkbox**, Combobox over main/develop/release (`kit-combobox`, placeholder **Branch**, empty **No match**), Accordion `w-64 kit-accordion` with one item **Accordion**.
- **AI Elements** (`flex max-w-xl flex-col gap-4`): `FileTree kit-file-tree` of `out/report.md`, `out/data/a.json`; `PromptInput kit-prompt-input` (controlled); `ModelSelector catalog=null` (both menus disabled); `StackTrace kit-stack-trace` (**Error: boom**, `at run (src/run.ts:1:1)`); `Terminal kit-terminal` **pnpm build** / **done** open; `EnvironmentVariables kit-env` `[{ name: "RUN_INPUT", value: "{}", badge: "frozen" }]`.

### Data components used only here

| Component              | File                                        | Props                                                                                                      | Look                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RunStatusBadge`       | `components/data/RunStatusBadge.tsx`        | `status: RunStatus, needsYou?, data-testid = "run-status"`                                                 | needsYou → default **Awaiting approval** (`ShieldCheck`); succeeded secondary `Check`; running outline spinning `LoaderCircle`; failed destructive `CircleAlert`; queued outline `Clock`; cancelled secondary `Ban`. Label is the raw status otherwise                                                                                                                                                                                                                                                                                                                        |
| `ImpactBadge`          | `data/ImpactBadge.tsx`                      | `impact: "read"\|"local"\|"cloud", data-testid = "impact-badge"`                                           | read secondary **Read** `BookOpen`; local outline **Local** `HardDrive`; cloud default **Cloud** `Cloud`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `FreshnessBadge`       | `data/FreshnessBadge.tsx`                   | `fresh, data-testid = "freshness-badge"`                                                                   | secondary **Fresh** `Leaf` / outline **Stale** `Clock`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `PublishPolicyBadge`   | `data/PublishPolicyBadge.tsx`               | `policy: PublishPolicy, data-testid = "policy-badge"`                                                      | secondary; **Read only** `Lock`, **Approve each publish** `ShieldCheck`, **Trust agent review** `Bot`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `EnvironmentVariables` | `data/EnvironmentVariables.tsx`             | `vars: {name, value, badge?}[], data-testid?`                                                              | `ItemGroup.gap-2` of outline Items: mono name/value, optional secondary Badge, checked disabled `Switch aria-label="<name> set"`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ModelSelector`        | `components/ai-elements/model-selector.tsx` | `catalog: CliModelCatalog \| null, model, effort, onChangeModel, onChangeEffort, disabled?, idPrefix = ""` | Two outline dropdown Buttons (`<prefix>field-model`, `<prefix>field-effort`, `ChevronDownIcon`) in `<prefix>model-selector`. Model menu (`min-w-48`): label **Model**, radio `""` = `catalog.defaultLabel ?? "Default"`, catalog models, separator, **Custom…** (shows `Input <prefix>field-model-custom` placeholder **custom model id**; empty → undefined; picking Custom uses draft or `"custom"`). Effort menu (`min-w-36`): **Default** + efforts of the selected model (or union of all models) capitalized. Disabled when no catalog. Non-custom picks close the menu |
