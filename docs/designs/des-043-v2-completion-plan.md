---
id: DES-043
title: "v2 completion plan: mock parity and old-app removal"
type: design
status: active
summary: Audit of the app against the mock blueprint, the gaps (UI, run core, old engine, extra pages) and the phases that close them.
tags: [v2, plan, mock, cleanup, roadmap, design]
related: [DES-014, DES-016, DES-017, DES-038, DES-039, DES-041, DES-042]
updated: 2026-11-24
---

# v2 completion plan: mock parity and old-app removal

## Goal

v2 is done when two things are true:

1. **Mock parity.** Every feature in the mock works in the app, on real
   data over FCP.
2. **Nothing else.** The app has no page, route, package or data path that
   the mock does not need. The old app is gone.

BL-105 to BL-192 are all `done`, but that measures backlog items, not this
goal. This doc compares the code with the goal and lists what is left.

## The baseline: what "the mock" is

The mock is the blueprint written in `apps/web/src/pages/mock/` at commit
`22ff78c` (PR #3, "Docket mockups"). Its routes were `/mock/docket`,
`/workflows`, `/workflows/:id`, `/inbox`, `/files`, `/library`, `/skills`
and `/connectors`. It had **no Runs page**: runs lived inside a card
(`RunBar`, `CardRunsSection`, `RunWorkflowDialog`) and a workflow
(`WorkflowSheet`). It had no Settings page and no Home. Its data lived in
in-memory stores (`*-store.ts`, `*-data.ts`).

## Audit result

### A. Pages beyond the mock

| Item                                            | State                                                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/runs` page (`pages/runs/`, ~800 lines)        | Not in the mock. It came from the old app (`RunsPage`) and was re-pointed at FCP by BL-180 instead of being removed. |
| `/settings`                                     | Not in the mock; theme only after BL-185. Needs a decision (below).                                                  |
| `/brand`, `/dev/kit`                            | Reference pages, not product. Keep dev-only.                                                                         |
| `/mock/*` redirects, `MockShell`, `MockSidebar` | Names and redirects left over from the promotion in BL-185.                                                          |

### B. Mock features missing from the app

Backend methods exist for most of these (FCP has 25 methods the web never
calls). The gap is mainly UI. The old mock components are still in
`pages/mock/` but no route reaches them.

| Area       | In the mock                                                                                                                                                                                                                                                                         | In the app now                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Docket     | Card panel with `RefsSection`, `PropertiesSection`, `LinksSection`, `AssetsSection`, `RefDataSection`, `CardRunsSection`, item files, run bar                                                                                                                                       | Card panel edits title and body only. `docket/add_asset`, `remove_asset`, `update` are never called.                |
| Workflows  | Node canvas editor: `FlowNodes`, `FlowNodesIO`, `AddNodeMenu` (search nodes), `NodeSettings` (system prompt, output format, time limit, if it fails, if unsure, auto-reject), `NodeShell`, `FlowToolbar` (undo, redo, fit view, run), `StepConnectors`, `TriggerInputs`, `ModelRow` | `WorkflowEditorPage` is a YAML textarea. `workflow/save_layout`, `validate`, `rename`, `update` are never called.   |
| Runs       | Run for a card (`RunWorkflowDialog`, `RunBar`), runs list on the card and on the workflow sheet                                                                                                                                                                                     | A separate Runs page; no run entry on a card, none on the canvas.                                                   |
| Library    | `LibrarySheet`, `LibraryVersions`, `AddLibraryDialog`, `LibraryViews`, `LibraryTags`, `ProviderDetect`, `RemoteBlock`, `LibraryFilePicker`                                                                                                                                          | Table plus providers dialog. `library/pull`, `pin_version`, `set_tags`, `get`, `remove`, `update` are never called. |
| Skills     | `SkillSources` (add a skill source), `SkillSheet`, usage by node                                                                                                                                                                                                                    | Table and sheet. `skill/update` is never called.                                                                    |
| Connectors | `AddConnectorDialog`, `ConnectorSheet`, step usage                                                                                                                                                                                                                                  | Present. `connector/sign_in`, `check`, `update` are never called.                                                   |
| Inbox      | Item cards and answers                                                                                                                                                                                                                                                              | Present (permission, question, plan review). Verify against the mock in the audit task.                             |
| Files      | Tree, preview, edit, `DiskPicker`, item files                                                                                                                                                                                                                                       | Tree, preview, edit. `file/reveal` and `file/stat` are never called.                                                |

### C. Old app still present

| Item                         | Evidence                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old engine runs the runs     | The daemon, CLI and desktop all build `createEngine` from `@workspace/engine` (37 imports in `apps/server`). Runs go through `engine.ts` → `nodes/drive.ts`.                                                                                                                                             |
| Run core is built, not wired | `core/runs` (`decide`, `actor`, `createScheduler`) has no caller outside its own package and tests. Phase 32 ("runs execute on core") is not true in the running app.                                                                                                                                    |
| `packages/engine` is large   | 75 top-level files plus `nodes/`: `runner.ts`, `judge.ts`, `publish*.ts`, `library*.ts`, `workitems.ts`, `connections.ts`, `work-copy.ts`, `cli-adapters.ts`.                                                                                                                                            |
| Old domain models            | `work-item`, `connection`, `attempt-kind`, `api*.ts` in `contracts` and `packages/shared` shim. Work items were replaced by Docket cards (DES-038); connections by connectors.                                                                                                                           |
| Dead mock island             | `pages/mock/` is 61 files and about 6,500 lines. The app imports five of them (`InlineText`, `ref-from-link`, `NewWorkflowDialog`, `WorkflowRowMenu`, `FilesTree`) plus the shell. The rest is reachable only from itself. Stores and `*-data.ts` still hold fake data and feed the sidebar Inbox badge. |
| Old tests                    | `apps/e2e` specs and `layout.spec.ts` baselines still cover `/runs` and other old behavior.                                                                                                                                                                                                              |

## Decisions (approved 2026-11-24)

1. **Runs.** Recommended: remove `/runs` as a page. Show runs in context as
   the mock does: on the card, on the workflow sheet and on the canvas.
   Reuse `RunSheet` for the detail. Keep `flows run` in the CLI.
2. **Settings.** Not in the mock. It carries trust, CLI and MCP trust that
   the app needs. Recommended: keep it as a panel opened from the sidebar
   footer, not a route, and add the missing FCP methods.
3. **Mock data and names.** Recommended: rename `pages/mock` to shared
   components per area, delete every `*-store.ts` and `*-data.ts`.

## Plan

Phases continue the numbering of DES-017. Each phase ends with
`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` green.

| Phase | Name                         | Work                                                                                                                                                                                                           | Done when                                                                              |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 37    | Parity audit                 | One checklist from the `22ff78c` mock: every screen, action and state, each marked app, partial or missing, with a test id. Resolve the three decisions.                                                       | the checklist is the acceptance list for phases 38 to 41                               |
| 38    | Run core in the loop         | Wire `core/runs` actor and scheduler into the host. Move node executors, judge, publish and asset steps behind core ports. Engine tests pass on core.                                                          | a run executes on core with adapters; `createEngine` runs no run logic                 |
| 39    | Mock UI on real data         | Rebuild missing UI per area over FCP: card panel sections, canvas editor with node settings and undo, run entry on cards and workflow, library sheet with versions and tags, skill sources, connector sign-in. | every checklist row for Docket, Workflows, Library, Skills, Connectors, Files is `app` |
| 40    | Remove what the mock has not | Delete the `/runs` page (per decision 1), `/mock/*` redirects, `Mock*` names, all `*-store.ts` and `*-data.ts`. Settings per decision 2.                                                                       | routes equal the mock routes plus dev pages; no fake data in the web                   |
| 41    | Retire the old engine        | Delete `packages/engine`, `packages/shared` shim, `work-item`, `connection` and `api*.ts` contracts. Move what is still needed into core or adapters.                                                          | no import of `@workspace/engine`; `pnpm build` and e2e pass                            |
| 42    | Verify                       | Run the checklist end to end in the desktop app and the web dev server. Refresh e2e and `layout.spec.ts` baselines to the mock screens.                                                                        | every checklist row passes; docs and roadmap match the code                            |

Order: 37 first. 38 and 39 can run in parallel (different packages). 40
needs 39 so no screen is lost. 41 needs 38 and 40.

## Risks

- **Phase 38 is the largest.** The old engine's behaviors (resume, partial
  runs, loops, judge, publish) must keep their tests when they move.
- **Settings and trust.** Cursor trust and sandbox setup are safety
  features. Do not drop them with the old Settings page; move them first.
- **Baselines.** Layout baselines change in phases 39 and 40. Update them
  in the same change as each screen.

## Backlog

BL-193 (phase 37), BL-194 to BL-197 (38), BL-198 to BL-208 (39), BL-209 to BL-212 (40),
BL-213 to BL-215 (41), BL-216 and BL-217 (42). Phases are in DES-017.
