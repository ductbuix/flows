---
id: DES-017
title: Roadmap
type: direction
status: active
summary: Build phases in backlog order, the goal of each phase and what it unlocks. Status lives in the backlogs index.
tags: [direction, roadmap, backlog, phases]
related: [DES-014, DES-015, DES-018, DES-019, DES-020, DES-021, DES-022]
updated: 2026-11-21
---

# Roadmap

Phases follow the backlog order (priority, then `depends`). Status lives
in the [backlogs index](../backlogs/INDEX.md); this doc only says why the
order is what it is. Goals come from [DES-014](des-014-vision.md).

| Phase | Goal                         | Backlog items                                           | Done when                                         |
| ----- | ---------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| 0     | Foundation                   | BL-001 scaffold, BL-002 tooling, BL-003 docs            | done                                              |
| 1     | A run that is reliable       | BL-004 engine core, BL-005 resume                       | a workflow runs and survives a restart            |
| 2     | Control flow                 | BL-014 approval and cancel, BL-006 conditions and loops | gates, cancel, when, retry and repeat work        |
| 3     | Agents and dynamic workflows | BL-007 agent tasks and spawn                            | an agent fans out by spawning tasks               |
| 4     | See and steer runs           | BL-008 run view, BL-012 run controls                    | live run view with every control                  |
| 5     | Author workflows             | BL-009 graph editor, BL-013 workflow lifecycle          | edit graph and YAML in sync, manage workflows     |
| 6     | Hardening                    | BL-011 agent judge, BL-010 sandboxing                   | judge conditions; writes held to the workflow dir |
| 7     | Use the editor               | BL-015 agent kind, BL-016 file editing                  | switch a task to agent; edit memory and instructions  |
| 8     | Safe agent runs              | BL-017 timeouts, BL-018 app trust                       | hung agents end; trust and pre-run check before CLIs  |
| 9     | Fixed prompts and task ids   | BL-019 paths and ids, BL-020 prompt editor              | generated ids; prompts at tasks/<id>/prompt.md; drawer edits name and prompt |
| 10    | Reuse a workflow with inputs | BL-021 run input engine, BL-022 start form              | start a run with declared inputs; extras queue; the run view shows the files |
| 11    | Remove a task in the editor  | BL-023 trash on save, BL-024 editor delete              | delete one task, undo before save, folder moves to tasks/.trash              |

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

## Not on the roadmap

The non-goals in [DES-014](des-014-vision.md) stay out until their
revisit trigger in [DES-007](des-007-tradeoffs.md) fires.
