---
id: DES-032
title: Node catalog
type: design
status: draft
summary: The nine node kinds, with settings, ports, how each runs, named answers and templates, and how each looks on the canvas.
tags: [design, workflow, nodes, judge, asset, agent]
related: [DES-031, DES-033, DES-034, DES-035, DES-036, DES-026, DES-023]
updated: 2026-11-22
---

# Node catalog

Nine kinds in three groups, as in OpenBot's Add node menu
(`packages/ui/src/features/workflows/WorkflowAddMenu.tsx`: Inputs,
Steps, Flow). Decorative kinds (note, text, shape, drawing) are later.

| Group  | Kind     | In ports   | Out ports  | Runs a process | OpenBot kind |
| ------ | -------- | ---------- | ---------- | -------------- | ------------ |
| Inputs | trigger  | none       | text, file | no             | trigger      |
| Inputs | prompt   | none       | text       | no             | prompt       |
| Inputs | asset    | none       | file, text | no             | asset        |
| Steps  | agent    | text, file | text, file | yes, agent CLI | agent        |
| Steps  | command  | text, file | text, file | yes, shell     | none         |
| Steps  | llm      | text, file | text       | yes, CLI print | llm          |
| Flow   | judge    | text, file | yes, no    | rule mode only | condition    |
| Flow   | approval | text, file | text, file | no             | approval     |
| Flow   | output   | text, file | none       | no             | output       |

Port types are `text` and `file`. OpenBot also has `image`; in flows an
image is a file. A Judge's outputs are its `yes` and `no` branches, and
each forwards what came in. Wiring rules live in one port table, as in
OpenBot's `WORKFLOW_PORTS` (`packages/contracts/src/ipc-workflows.ts`).

## Shared by every node

- `id` (generated, `node-` plus 8 hex), `kind`, `name` (display label).
- On the canvas: name, kind icon, ports, status, timer, result,
  Run step, Retry when failed (DES-036).
- Step kinds (agent, command, llm, judge in rule mode) take `timeout`
  and `retry: { max }` as today (DES-019, DES-004 retry rules).

## Trigger

- Purpose: where a run starts. It replaces the Start card's inputs.
- Settings: `type` (`manual` only in the first slices; open question
  1 in DES-031), `inputs` (the DES-021 declared fields, moved here).
- Run: emits the run input as text (the filled form, and the work item
  title and notes when the run has one) and the input files on `file`.
- Several Trigger nodes are allowed, as in OpenBot. A run started
  from one trigger runs what that trigger reaches. "Run workflow" from
  the toolbar uses the first trigger in file order.
- UI: "Run workflow" button on the node; the Start dialog (BL-064)
  opens from it.

## Prompt

- Purpose: shared text, for example house rules, fed to several steps.
- Settings: none in YAML; the text lives in `nodes/<id>/text.md`.
- Run: emits the text, with `{{name}}` filled (below).
- UI: an inline Textarea on the node, with Copy.

## Asset

- Purpose: library resources as input. OpenBot's Asset holds one file
  (`WorkflowAssetNode.tsx`, field `fileId`); flows widens it to the
  library of DES-026, which pootato asked for: chosen GitHub repos,
  pulled Confluence pages, and more sources later.
- Settings: `resources` (each `{ connection, entity, id }`), `access`
  (`read` or `propose`, as DES-026 `uses`).
- Run: no process. At run start the resources are pulled and pinned
  (DES-026 pinning is unchanged). The step emits the pinned folders on
  `file` and a short index (title, source, revision) on `text`.
- A step wired from an Asset gets `RESOURCE_<ID>` paths as today; with
  `propose` it works in the run's work copy.
- UI: a picker grouped by connection, with search, and chips for the
  chosen resources; freshness shows as in the Library page.

## Agent

- Purpose: a coding agent does a task.
- Settings: `cli` (`claude` or `cursor`), `model`, `effort` (DES-023),
  `memory`, `answers` (named answers, below). The task text is
  `nodes/<id>/prompt.md` and may use `{{name}}`.
- Run: one stateless CLI process per attempt, sandboxed, cwd in the
  attempt folder (DES-005, DES-006). The agent sees its task, the
  joined text input in `input/text.md`, input files by path, and its
  memory. OpenBot hands work to a long-lived agent conversation
  instead; flows keeps its own model.
- Out: `text` is the answer (or `SUMMARY.md` when no answers are
  declared); `file` is the attempt's `out/` folder.
- UI: CLI and model pills plus the task Textarea on the node.

## Command

- Purpose: a script or command, as today.
- Settings: `run` (the command line).
- Run and out: as today; `text` is `SUMMARY.md` or the last 4 KB of
  stdout, `file` is `out/`.

## LLM

- Purpose: one model call with no tools, for summaries and rewrites.
- Settings: `cli`, `model`, `effort`, `answers`; files
  `nodes/<id>/prompt.md` and optional `nodes/<id>/system.md`.
- Run: the CLI in print mode with tools turned off and a read-only
  sandbox. The prompt is built as OpenBot's `modelStepPrompt` does
  (system, prompt, then the input). The exact "no tools" flags for each
  CLI are checked in BL-083.
- Out: `text` only.

## Judge

pootato's description: a dedicated node with custom judge
instructions, a model and an effort, that decides the yes or no path.
OpenBot's condition node works that way in its main mode
(`src/backend/workflows/workflow-walk.ts` `conditionPrompt`,
`conditionAnswer`; `workflows.ts` `startGeneration`):

- Rule mode (default): settings `cli`, `model`, `effort`; the
  instructions are `nodes/<id>/rule.md`. The CLI is asked to answer one
  word, yes or no, for the input. The first word decides: `yes` or
  `true` takes Yes, `no` or `false` takes No, anything else fails the
  node ("unclear answer").
- Check mode: settings `check` (field, operator, value). It tests a
  named answer from upstream with no model call. Operators as OpenBot
  `WORKFLOW_CHECK_OPERATORS`: `=`, `!=`, `>`, `>=`, `<`, `<=`,
  `contains`, `set`, `unset`.
- Out: the input is forwarded on the taken branch; the other branch's
  path is skipped.
- Gap: OpenBot shows the rule as the condition text on the node; the
  "custom judge instructions" pootato wants are that rule, written to
  a file so long rules diff well. Check mode is OpenBot's second mode
  (open question 3 in DES-031).
- UI: rule Textarea plus CLI and model pills; Yes and No ports on the
  right; after a run the taken branch is marked.

## Approval

- Settings: `question` (inline, may use `{{name}}`).
- Run: the step waits; the app shows the question in Needs you.
  Approve forwards the input; Reject stops the whole run, as OpenBot's
  `decide` does (`workflows.ts`).
- UI: question on the node; Approve and Reject buttons while waiting.

## Output

- Purpose: where results go. A workflow may have several.
- Settings: `target` and the target's own settings:
  - `folder`: copy inputs to the run's `output/` folder (and to the
    workflow `output/` when `latest: true`).
  - `publish`: `connection`; builds the change set from that
    connection's work copy and gates it by the policy (DES-026 publish
    rules move here unchanged).
  - `notify`: an in-app notice with `title` and the input text. flows
    has no in-app notice today (no notification code on `develop`), so
    this target needs a small notice store and a bell; it is its own
    later backlog.
- Run: no process; publish uses the existing publish events.
- UI: a target Select on the node, then that target's fields.

## Named answers and templates

As in OpenBot (`packages/contracts/src/ipc-workflow-answers.ts`):

- Agent and LLM nodes may declare `answers`: up to 20 fields, each with
  a name and a type (`text`, `number`, `yes/no`, `list`, `choice` with
  labels).
- The step is asked to end with the answer as JSON. Agents write
  `out/answer.json`; LLM steps print it. If it does not match, the step
  is asked once to fix it, then fails.
- Later nodes use `{{name}}` in prompt, rule, question and Prompt text.
  A name resolves from the nearest upstream answer; a name that two
  upstream nodes declare fails validation.
- A Judge in check mode tests a named answer.
