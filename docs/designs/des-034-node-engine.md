---
id: DES-034
title: Node engine
type: design
status: draft
summary: "Engine for node graphs: event types, the walk, loops with back edges and a limit, judge, approval, outputs, data passing, recovery."
tags: [design, engine, events, loops, judge, resume]
related:
  [DES-031, DES-032, DES-033, DES-003, DES-004, DES-005, DES-019, DES-026]
updated: 2026-11-22
---

# Node engine

The engine keeps its core (DES-003): append, then act; state is a fold
over the event log; every event wakes a tick; resume replays the log.
What changes is the unit of work and the rule that picks the next one.
The walk mirrors OpenBot's `nextActions` and `runScope`
(`src/backend/workflows/workflow-walk.ts`) in flows' own code.

## Steps

A step is one pass of one node. A pass has one or more attempts
(retries). A node without loops has one pass; each loop round adds a
pass. Step state: `pending`, `running`, `waiting` (approval),
`done`, `failed`, `skipped`, `cancelled`. A `done` step records its
output refs, its branch (Judge) and its answer.

## Event types

| Event                  | Status  | Meaning                                                                                               |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `run_started`          | changed | carries the v2 graph and `schemaVersion: 2`, plus `from` and `only` for partial runs                  |
| `run_activated`        | kept    | queued run starts (DES-021)                                                                           |
| `step_started`         | new     | node, pass and step id written before any action                                                      |
| `attempt_started`      | changed | carries `nodeId` and `pass`; written before launch                                                    |
| `attempt_launched`     | changed | pid, sandboxed, timeout, model and effort, as today                                                   |
| `attempt_finished`     | changed | exit code and reason                                                                                  |
| `attempt_interrupted`  | kept    | resume could not re-attach                                                                            |
| `step_done`            | new     | outputs, `branch` for a Judge, `answer` when declared                                                 |
| `step_failed`          | new     | reason: exit, timeout, unclear, answer, loop_limit, rejected                                          |
| `step_skipped`         | new     | no active input reached the node                                                                      |
| `approval_requested`   | changed | for an Approval step, with the filled question                                                        |
| `step_approved`        | new     | replaces `task_approved`                                                                              |
| `step_rejected`        | new     | replaces `task_rejected`; the run then stops                                                          |
| `step_retry_requested` | new     | manual retry; replaces `task_retry_requested`                                                         |
| `cancel_requested`     | kept    | stop scheduling, end process groups                                                                   |
| `step_cancelled`       | new     | replaces `task_cancelled`                                                                             |
| `run_succeeded`        | kept    | no step failed                                                                                        |
| `run_failed`           | kept    | a step failed and nothing is left to run                                                              |
| `run_cancelled`        | kept    | cancel, or an Approval rejected                                                                       |
| `run_deleted`          | kept    | marker before removing the run folder                                                                 |
| library, publish       | kept    | `library_pulled`, `work_copy_changed`, `publish_started`, `publish_finished`, `agent_review_finished` |

Removed: `tasks_spawned`, `task_succeeded`, `task_failed`,
`task_skipped`, `task_approved`, `task_rejected`, `task_cancelled`,
`task_retry_requested`.

## The walk

Each tick: fold, then `nextActions(graph, scope, latest)`:

1. Find loop edges (below). The rest are forward edges.
2. Visit nodes in forward order. A node is due when a forward input has
   a newer result than the node's latest step, or a loop edge's source
   has a newer active result (the next pass).
3. A due node waits while any forward input is still due or open.
4. An edge is active when its source step is `done` and, for a Judge,
   the edge's branch is the one taken.
5. A due node with no active input is skipped, and the skip flows on.
6. Otherwise it runs with the active inputs, in edge file order. Steps
   with several forward inputs wait for all of them (OpenBot's join
   rule, applied to every kind).

For each action the engine appends `step_started` (or `step_skipped`),
then acts. Limits are as today (DES-003): agent, LLM and rule Judge
steps count against `agents`; trigger, prompt, asset, check Judge,
approval and output steps hold no slot.

A run settles when no step is open and the walk returns nothing:
`run_failed` if any step failed, else `run_succeeded`. Open steps on
other branches finish first, as in OpenBot's `advance`.

## Loops

- Loop edges are found as OpenBot's `workflowLoopEdges` does: a
  self edge is a loop edge; in each cycle, the edges from inside into
  the cycle's entry node are loop edges. The entry is the cycle node
  reached first in forward order from the triggers.
- OpenBot breaks ties by top-left canvas position. flows breaks them
  by node order in `workflow.yaml`, so the engine never reads the
  layout file.
- A loop edge starts a new pass of its target when its source has a
  newer active result. Downstream nodes then run again in the new pass.
- Loop limit (new; OpenBot has none): `limits.loopPasses`, default 5.
  A node that would start pass 6 fails with reason `loop_limit`.
- The editor draws loop edges as a curved line with a loop badge and
  shows the pass count on each node after a run.

## Kinds at run time

| Kind     | Action                                                                     |
| -------- | -------------------------------------------------------------------------- |
| trigger  | `step_done` with the run input text and input files                        |
| prompt   | `step_done` with `text.md`, templates filled                               |
| asset    | `step_done` with the pinned folders and an index; pins come from run start |
| agent    | launch the CLI, as today; read `SUMMARY.md` and `out/answer.json`          |
| command  | launch the command, as today                                               |
| llm      | launch the CLI in print mode, tools off; parse the answer from stdout      |
| judge    | rule: launch the CLI judge, parse yes or no; check: test the answer now    |
| approval | `approval_requested`, then wait for `step_approved` or `step_rejected`     |
| output   | folder: copy; notify: notice; publish: the DES-026 publish flow            |

Each kind is an executor in the registry (DES-035), so the scheduler
has no kind branches.

## Judge

- Rule mode reuses `packages/engine/src/judge.ts` (command build,
  model and effort resolution, cache key), with two changes: the
  prompt is the yes or no question shaped like OpenBot's
  `conditionPrompt`, and the result is the first word of stdout
  (`conditionAnswer`), not the exit code. Unclear fails the step.
- The cache key adds the pass and a hash of the input, so a loop
  round never reuses an old verdict.
- Check mode evaluates in the tick with no process.

## Approval

- Waiting steps hold no slot and survive restarts (events).
- Approve: `step_approved`, then `step_done` that forwards the input.
- Reject: `step_rejected`, then the run stops as for cancel and ends
  `run_cancelled` with reason `rejected` (OpenBot `decide`).
- The publish policy "Approve each publish" in DES-026 stays inside
  the Output step; it is not an Approval node.

## Data passing

- Each attempt gets `input/text.md`: the active text inputs joined in
  edge order, each under a heading with the source node name.
- File inputs are links under `input/files/<fromNodeId>/` and stay in
  env as `UPSTREAM_<id>` (the id with `-` as `_`).
- `NODE_IN`, `NODE_OUT`, `RUN_INPUT`, `RESOURCES_DIR`,
  `RESOURCE_<ID>`, `WF_DIR`, `WF_INPUT`, `WF_OUTPUT`, `RUN_ID` as
  today; `TASK_*` names become `NODE_*`.
- Judge and Approval forward their inputs unchanged, so a step after
  them sees the same upstream paths.
- `{{name}}` is filled from the nearest upstream answer before launch.

## Partial runs

- Run step (one node): a run with `only: [nodeId]`. Inputs come from
  the latest done steps of the nodes it reads, as OpenBot's
  `soloInputs`. It shows in the run history as a step run.
- Run from here: `from: nodeId`. Steps before it whose settings and
  inputs did not change are reused, as OpenBot's `runScope` and
  `currentAnswers`; the rest run again.

## Retry

- `retry: { max }` retries a failed attempt in the same pass, as today
  (`packages/engine/src/attempt-kind.ts`).
- Manual retry (`step_retry_requested`) reopens a finished run and
  resets that step and what follows it.

## Crash recovery

- Append, then act, unchanged: `step_started` and `attempt_started`
  are written before any launch, so a crash cannot start a duplicate.
- Resume replays the log, re-attaches live pids, and records
  `attempt_interrupted` otherwise; the retry policy applies
  (`packages/engine/src/resume.ts`).
- A `step_started` with no attempt and no end is acted on again. Kinds
  with no process are safe to repeat: their output is a pure function
  of the frozen graph, the pins and earlier events.
- Publish keeps its `publish_started` and `publish_finished` ledger,
  so a crash between them shows as uncertain, as today.

## Removed code

- Spawn: `spawn.ts`, `spawn-parse.ts`, `spawn-validate.ts`,
  `writeSpawnRejections`, `resolveSpawn`, the spawn hint in
  `agent-prompt.ts`, the promote action, `tasks_spawned`.
- Old conditions: `conditions-expr.ts`, the `exit`, `expr`, `all`,
  `any` shapes in `conditions.ts`, `needs.ts` branch rules, and the
  `repeat` logic in `loops.ts` (`decideLoop`, `evalUntil`).
- Task folds: `fold.ts` and `fold-apply.ts` move to steps.

## Existing runs in app.db

Old runs are not replayed. The fold reads `schemaVersion` from
`run_started`; runs without `2` are skipped with one log line, and the
lists never show them. Their events stay (the log is append-only); a
run folder goes when pootato deletes its workflow. A cleanup command
is open question 9 in DES-031.
