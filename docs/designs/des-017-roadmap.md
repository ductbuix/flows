---
id: DES-017
title: Roadmap
type: direction
status: active
summary: Build phases in backlog order, the goal of each phase and what it unlocks. Status lives in the backlogs index.
tags: [direction, roadmap, backlog, phases]
related:
  [
    DES-014,
    DES-015,
    DES-018,
    DES-019,
    DES-020,
    DES-021,
    DES-022,
    DES-023,
    DES-024,
    DES-025,
    DES-026,
    DES-027,
    DES-028,
    DES-029,
    DES-030,
    BL-073,
    DES-031,
    DES-037,
  ]
updated: 2026-11-24
---

# Roadmap

Phases follow the backlog order (priority, then `depends`). Status for
open work lives in the [backlogs index](../backlogs/INDEX.md); phases
37–42 are `done` (BL-193…BL-217). Goals come from
[DES-014](des-014-vision.md).

| Phase | Goal                           | Backlog items                                                                                                                                    | Done when                                                                                  |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 0     | Foundation                     | BL-001 scaffold, BL-002 tooling, BL-003 docs                                                                                                     | done                                                                                       |
| 1     | A run that is reliable         | BL-004 engine core, BL-005 resume                                                                                                                | a workflow runs and survives a restart                                                     |
| 2     | Control flow                   | BL-014 approval and cancel, BL-006 conditions and loops                                                                                          | gates, cancel, when, retry and repeat work                                                 |
| 3     | Agents and dynamic workflows   | BL-007 agent tasks and spawn                                                                                                                     | an agent fans out by spawning tasks                                                        |
| 4     | See and steer runs             | BL-008 run view, BL-012 run controls                                                                                                             | live run view with every control                                                           |
| 5     | Author workflows               | BL-009 graph editor, BL-013 workflow lifecycle                                                                                                   | edit graph and YAML in sync, manage workflows                                              |
| 6     | Hardening                      | BL-011 agent judge, BL-010 sandboxing                                                                                                            | judge conditions; writes held to the workflow dir                                          |
| 7     | Use the editor                 | BL-015 agent kind, BL-016 file editing                                                                                                           | switch a task to agent; edit memory and instructions                                       |
| 8     | Safe agent runs                | BL-017 timeouts, BL-018 app trust                                                                                                                | hung agents end; trust and pre-run check before CLIs                                       |
| 9     | Fixed prompts and task ids     | BL-019 paths and ids, BL-020 prompt editor                                                                                                       | generated ids; prompts at tasks/<id>/prompt.md; drawer edits name and prompt               |
| 10    | Reuse a workflow with inputs   | BL-021 run input engine, BL-022 start form                                                                                                       | start a run with declared inputs; extras queue; the run view shows the files               |
| 11    | Remove a task in the editor    | BL-023 trash on save, BL-024 editor delete                                                                                                       | delete one task, undo before save, folder moves to tasks/.trash                            |
| 12    | Pick model and effort          | BL-025 adapters and records, BL-026 editor selects                                                                                               | each agent task and judge can set model and effort, or use the CLI default                 |
| 13    | UI on the shadcn baseline      | BL-027 shell and alignment, BL-028 run view, BL-029 editor, BL-030 polish                                                                        | one shadcn look everywhere; sidebar, Settings, Advanced and AI Elements                    |
| 14    | Journey shell on today's data  | BL-031 kit, BL-032 routes, BL-033 runs API, BL-034 pages, BL-035 Home, BL-036 run view, BL-037 workflow tabs                                     | Home, Workflows, Runs and flat URLs; no Advanced switch                                    |
| 15    | Work items                     | BL-038 store, BL-039 run link, BL-040 pages, BL-041 Start card                                                                                   | pick a work item, run a workflow on it, see its runs                                       |
| 16    | Connections and library (read) | BL-042 model, BL-043 library, BL-044 GitHub read, BL-045 pages, BL-046 editor and pins, BL-047 retention                                         | tasks read pinned GitHub data; freshness and pins visible                                  |
| 17    | Gated publish                  | BL-048 change sets, BL-049 publish task, BL-050 GitHub publish, BL-051 publish UI, BL-052 agent review, BL-056 ports and caches                  | a draft PR is published only after approval, with a ledger                                 |
| 18    | More sources                   | BL-053 cookie store, BL-054 Confluence, BL-055 Rally                                                                                             | MCP and cookie sign-ins work; tasks cannot read cookies                                    |
| 19    | Page frame and sizes           | BL-057 frame, BL-058 sizes, BL-059 labels, BL-060 kit, BL-061 guards, BL-073 workflow name                                                       | one frame, 32px controls, 37px rows; layout check passes                                   |
| 20    | Run view, summary first        | BL-062 summary, BL-063 tasks, BL-064 Start and trust                                                                                             | a failed run opens on its failed task Terminal                                             |
| 21    | Editor with a task Sheet       | BL-065 frame, BL-067 workflow settings (BL-066 superseded by BL-078, BL-095)                                                                     | an agent task with prompt, model and memory in 11 clicks                                   |
| 22    | Home and lists                 | BL-068 Home, BL-069 work items, BL-070 workflows and runs, BL-071 connections and settings                                                       | first launch to a started run from a work item in 7 clicks                                 |
| 23    | Command palette (later)        | BL-072 palette                                                                                                                                   | ⌘K reaches every page and common action                                                    |
| 24    | Node core, additive            | BL-074 schema, BL-088 YAML helpers, BL-089 step events, BL-075 walk, BL-090 tick, BL-091 agent and command                                       | a Trigger, Prompt, Command, Agent and Output run passes engine tests; the app is unchanged |
| 25    | Node server behind a flag      | BL-076 workflow files, BL-092 layout, BL-093 runs                                                                                                | with `FLOWS_NODES=1` a node workflow saves, keeps its layout and runs over the API         |
| 26    | Node canvas behind a flag      | BL-077 canvas, BL-094 Add node, BL-078 cards, BL-095 Sheet, BL-104 Start and Overview, BL-086 run, BL-087 run view                               | with the flag on, build, start, run and inspect a workflow on the canvas                   |
| 27    | Switch and clean up            | BL-096 switch, BL-097 task UI out, BL-098 task engine out                                                                                        | nodes are the only format; no task path or flag is left                                    |
| 28    | Canvas runs and flow nodes     | BL-102 partial runs, BL-103 run history, BL-079 Judge, BL-080 Approval, BL-081 loops                                                             | Run step, run history, a Judge loop ending by verdict or limit, an Approval holding a run  |
| 29    | Inputs, LLM and outputs        | BL-083 LLM, BL-082 Asset, BL-099 picker, BL-084 publish, BL-100 notify, BL-085 answers, BL-101 check                                             | repos and pages feed an agent, a draft PR is published, answers fill templates             |
| 30    | v2 protocol foundations        | BL-105 to BL-109 protocol, BL-110 to BL-112 contracts, BL-113 core kernel, BL-114 lint                                                           | peer, transports, method table and core kernel tested; app unchanged                       |
| 31    | FCP live beside REST           | BL-115 bind, BL-116 initialize, BL-117 lock, BL-118 /fcp, BL-119 updates, BL-120 to BL-122 sdk, BL-123 and BL-124 reads                          | a client lists workflows and follows runs over /fcp                                        |
| 32    | Ports and run core             | BL-125 to BL-130 ports, BL-131 decide, BL-132 actor, BL-133 scheduler, BL-134 and BL-135 executors                                               | runs execute on core with adapters; engine tests green on fakes                            |
| 33    | ACP agents and Inbox           | BL-136 to BL-143 ACP and nodes, BL-144 policy, BL-145 Inbox, BL-146 to BL-150 permissions and Cursor extensions                                  | an LLM step runs on Cursor ACP; permissions wait in the Inbox                              |
| 34    | Contexts on core               | BL-151 to BL-159 Docket, BL-160 to BL-164 connectors, BL-165 to BL-167 gateway, BL-168 to BL-170 skills, BL-171 to BL-176 library, files, writes | every mockup area has its FCP methods                                                      |
| 35    | Web on the sdk                 | BL-177 to BL-184 pages, BL-185 REST out                                                                                                          | web uses only the sdk; REST is blobs and health                                            |
| 36    | Desktop and CLI                | BL-186 to BL-190 desktop, BL-191 CLI                                                                                                             | Electron runs or attaches to the engine; flows run works from a terminal                   |
| 37    | Parity audit                   | BL-193 checklist                                                                                                                                 | done                                                                                       |
| 38    | Run core in the loop           | BL-194 wiring, BL-195 executors, BL-196 semantics, BL-197 hosts                                                                                  | done                                                                                       |
| 39    | Mock UI on real data           | BL-198 to BL-208 card, canvas, workflow sheet, library, skills, connectors, inbox, files                                                         | done                                                                                       |
| 40    | Remove what the mock has not   | BL-209 Runs page, BL-210 Settings panel, BL-211 mock folder, BL-212 names                                                                        | done                                                                                       |
| 41    | Retire the old engine          | BL-213 contracts, BL-214 leftovers, BL-215 delete package                                                                                        | done                                                                                       |
| 42    | Verify                         | BL-216 e2e baselines, BL-217 verification                                                                                                        | done                                                                                       |

## Why this order

- The engine comes first because every screen shows its events; a UI
  without it would be built against guesses.
- Resume sits in phase 1 because append-then-act is cheapest to get right
  before more event types exist.
- BL-014 and BL-006 both need only BL-005 and can go in either order.
- The run view comes before the editor: a workflow can be written as
  YAML by hand, but runs cannot be watched without the UI.
- Sandboxing is last in the list but is a safety feature; move it up if
  untrusted commands or agents run before phase 6.
- Phase 7 is follow-up after the editor shipped (phase 5). BL-015 is
  first because a kind switch must produce a valid agent task before
  the instructions editor in BL-016 is useful.
- Phase 8 is next because agent CLIs can hang or prompt outside the
  app. BL-017 comes first so a hung prompt, or the live Cursor
  check in BL-018, cannot sit in `running`.
- Phase 9 follows once the editor is in use: a free `instructions`
  path, and a free-text task id, were too easy to get wrong.
  BL-019 comes first so the Inspector can drop the path and id
  fields.
- Phase 10 follows once a workflow can be edited and run safely:
  the same graph should accept different inputs without sharing
  one `input/` folder. BL-021 comes first so the form in BL-022
  has a schema, a start API, and a queued state.
- Phase 11 is a gap in the editor that is already safe to add:
  `removeTask` exists, but the UI cannot use it, and folders were
  left behind. BL-023 comes first so Save moves folders and
  refuses a remove that a live or queued run still needs.
- Phase 12 follows once agent tasks run reliably: the CLI should
  use a chosen model and effort, not only the user's global
  settings. BL-025 comes first so the selects in BL-026 have a
  schema, a catalog API, and attempt records.
- Phase 13 is a look and experience pass, not an engine
  capability. BL-027 comes first so later screens share the
  shell and the lint guard. BL-028 and BL-029 can go in either
  order. BL-030 is the final sweep.
- Phase 14 rearranges existing data only (DES-025), so every later
  page lands in the final shell. BL-031, BL-032 and BL-033 are
  independent and go first; BL-036 comes before BL-037 so the
  Advanced hook is removed once.
- Phase 15 needs no outside system: a work item is a local record.
  BL-038 and BL-039 come before the pages so the pages have an API.
- Phase 16 is read only on purpose: tasks use pulled data and nothing
  leaves the machine, so it is safe before any publish exists.
- Phase 17 adds the only Cloud impact (DES-026), behind a policy
  gate; GitHub first because a draft pull request is easy to undo.
- BL-056 has no dependency and helps any command task; it must land
  before `propose` tasks run installs or tests in repo copies.
- Phase 18 needs the cookie store and MCP trust, which GitHub does not.
- Phases 19 to 23 renovate the UI ([DES-027](des-027-ui-renovation.md))
  in pootato's order. Phase 19 comes first so every later screen lands
  on one frame, one size rule and the guards. BL-057 and BL-060 have no
  dependency and go first; BL-073 has none either and lands before
  BL-059 so labels read `name`. BL-061 comes last in the phase so its
  checks cover the finished frame.
- Phase 20 comes before 21: watching runs matters more than authoring,
  which can fall back on YAML. BL-064 lands with the run view because
  every start point uses its dialog.
- Phase 22 needs BL-064 for the work-item-first start.
- Phase 23 is later on purpose. The docs schema has no P3, so BL-072
  is P2 and depends on every phase 22 item.
- Phases 24 to 29 are the node workflows plan ([DES-031](des-031-node-workflows.md), [DES-037](des-037-node-delivery.md)). Phases 24 to 26 are additive or behind the temporary `FLOWS_NODES` flag, so the app keeps working; phase 27 switches over and deletes the task path. Phase 23 stays later. Phase 22 does not depend on them.

## Not on the roadmap

The non-goals in [DES-014](des-014-vision.md) stay out until their
revisit trigger in [DES-007](des-007-tradeoffs.md) fires.
