---
id: DES-044
title: "Mock parity checklist"
type: design
status: active
summary: "Every mock screen, action and state from 22ff78c vs the app: status, planned e2e id, backlog."
tags: [v2, mock, audit, checklist, design]
related:
  [
    DES-043,
    BL-193,
    BL-198,
    BL-199,
    BL-200,
    BL-201,
    BL-202,
    BL-203,
    BL-204,
    BL-205,
    BL-206,
    BL-207,
    BL-208,
    BL-209,
    BL-210,
    BL-211,
    BL-212,
    BL-216,
  ]
updated: 2026-11-24
---

# Mock parity checklist

Acceptance list for [DES-043](des-043-v2-completion-plan.md) phases 39–42.
Source mock: `apps/web/src/pages/mock/` at commit `22ff78c`. Compared to current
non-mock routes under `apps/web/src/pages/`.

**Status:** `app` = matches mock on FCP; `partial` = chrome or subset only;
`missing` = not in the product UI; `drop` = remove (not in mock, or cleanup).

**Backlog:** every `missing` / `partial` row maps to BL-198…BL-212 or BL-216.
`drop` rows map to the cleanup BL. `app` rows use `—` (covered when BL-216
refreshes baselines).

## Decisions (resolved 2026-11-24)

Recorded in DES-043; this checklist is the acceptance surface.

1. **Runs in context.** Remove `/runs`. Show runs on the card, workflow sheet
   and canvas; reuse `RunSheet` for detail. → BL-200, BL-203, BL-209.
2. **Settings as panel.** Keep trust/CLI/MCP; open from the sidebar footer,
   not a route; add missing FCP methods. → BL-210.
3. **Rename mock and delete stores.** Move shared UI out of `pages/mock`;
   delete every `*-store.ts` / `*-data.ts`; then drop `/mock/*` and `Mock*`
   names. → BL-211, BL-212.

## Docket

| id    | item                                          | status  | test id                            | backlog |
| ----- | --------------------------------------------- | ------- | ---------------------------------- | ------- |
| DK-01 | Board page, columns, empty lanes              | app     | `docket.spec.ts › board`           | —       |
| DK-02 | New card dialog (title, ref, body)            | app     | `docket.spec.ts › new card`        | —       |
| DK-03 | Add card from column                          | app     | `docket.spec.ts › add to column`   | —       |
| DK-04 | Drag-move card between columns                | app     | `docket.spec.ts › drag move`       | —       |
| DK-05 | Columns dialog (reorder, tone, migrate, save) | app     | `docket.spec.ts › columns`         | —       |
| DK-06 | Open card panel                               | app     | `docket.spec.ts › open panel`      | —       |
| DK-07 | Edit title and description                    | app     | `docket.spec.ts › edit title body` | —       |
| DK-08 | Delete card (confirm)                         | app     | `docket.spec.ts › delete card`     | —       |
| DK-09 | Refs: list, add URL, remove                   | app     | `docket.spec.ts › add ref`         | BL-198  |
| DK-10 | Properties: status, start/due, custom keys    | app     | `docket.spec.ts › properties`      | BL-198  |
| DK-11 | Links: relation + target card                 | app     | `docket.spec.ts › add link`        | BL-198  |
| DK-12 | Assets: link from library or disk             | missing | `docket.spec.ts › add asset`       | BL-199  |
| DK-13 | Item files menu (view / Finder / Cursor)      | missing | `docket.spec.ts › item files`      | BL-199  |
| DK-14 | Ref data section                              | missing | `docket.spec.ts › ref data`        | BL-199  |
| DK-15 | Card runs list                                | missing | `docket.spec.ts › card runs`       | BL-200  |
| DK-16 | Run workflow dialog from card                 | missing | `docket.spec.ts › run dialog`      | BL-200  |

## Workflows / canvas

| id    | item                                      | status  | test id                               | backlog |
| ----- | ----------------------------------------- | ------- | ------------------------------------- | ------- |
| WF-01 | Workflows list + search                   | app     | `workflows.spec.ts › list`            | —       |
| WF-02 | New workflow dialog                       | app     | `workflows.spec.ts › new`             | —       |
| WF-03 | Row menu: rename, delete                  | app     | `workflows.spec.ts › rename delete`   | —       |
| WF-04 | Workflow sheet (open from row)            | partial | `workflows.spec.ts › sheet`           | BL-203  |
| WF-05 | Sheet: open editor                        | app     | `workflows.spec.ts › open editor`     | —       |
| WF-06 | Sheet: inputs a card supplies             | missing | `workflows.spec.ts › sheet inputs`    | BL-203  |
| WF-07 | Sheet: runs by card                       | missing | `workflows.spec.ts › sheet runs`      | BL-203  |
| WF-08 | Sheet: start run for a card               | missing | `workflows.spec.ts › sheet start`     | BL-203  |
| WF-09 | Editor route (YAML textarea today)        | app     | `workflows.spec.ts › editor yaml`     | BL-201  |
| WF-10 | Node canvas, cards, edges, save layout    | app     | `workflows.spec.ts › canvas`          | BL-201  |
| WF-11 | Add node menu with search                 | missing | `workflows.spec.ts › add node`        | BL-202  |
| WF-12 | Node settings (prompt, format, limits, …) | missing | `workflows.spec.ts › node settings`   | BL-202  |
| WF-13 | Toolbar: undo, redo, fit view             | missing | `workflows.spec.ts › undo redo`       | BL-202  |
| WF-14 | Trigger inputs editor                     | missing | `workflows.spec.ts › trigger inputs`  | BL-202  |
| WF-15 | Step connectors / skills multi-pick       | missing | `workflows.spec.ts › step connectors` | BL-202  |
| WF-16 | Model row on node                         | missing | `workflows.spec.ts › model row`       | BL-202  |
| WF-17 | Duplicate / delete node                   | missing | `workflows.spec.ts › node actions`    | BL-202  |

## Runs in context

| id    | item                                  | status  | test id                              | backlog |
| ----- | ------------------------------------- | ------- | ------------------------------------ | ------- |
| RN-01 | Run entry on card (dialog + list)     | missing | `docket.spec.ts › run on card`       | BL-200  |
| RN-02 | RunBar on canvas (select card, start) | missing | `workflows.spec.ts › canvas run bar` | BL-203  |
| RN-03 | Run detail sheet (reuse `RunSheet`)   | partial | `runs.spec.ts › sheet in context`    | BL-209  |
| RN-04 | `/runs` page + start-from-list        | drop    | `runs.spec.ts › page gone`           | BL-209  |

## Library

| id    | item                                      | status  | test id                       | backlog |
| ----- | ----------------------------------------- | ------- | ----------------------------- | ------- |
| LB-01 | Providers dialog (list, presets, custom)  | app     | `library.spec.ts › providers` | —       |
| LB-02 | Search, kind tabs, list/gallery chrome    | partial | `library.spec.ts › chrome`    | BL-205  |
| LB-03 | Item list / gallery rows                  | app     | `library.spec.ts › list`      | BL-204  |
| LB-04 | Add dialog: from link / from disk         | missing | `library.spec.ts › add`       | BL-205  |
| LB-05 | ProviderDetect on paste link              | missing | `library.spec.ts › detect`    | BL-205  |
| LB-06 | DiskPicker (file / folder)                | missing | `library.spec.ts › disk pick` | BL-205  |
| LB-07 | Library sheet (overview, files, versions) | app     | `library.spec.ts › sheet`     | BL-204  |
| LB-08 | Versions: pin                             | app     | `library.spec.ts › pin`       | BL-204  |
| LB-09 | Remote: fetch / pull / push / unlink      | partial | `library.spec.ts › remote`    | BL-204  |
| LB-10 | Tags editor + tag rail filter             | missing | `library.spec.ts › tags`      | BL-205  |
| LB-11 | Remove from library                       | app     | `library.spec.ts › remove`    | BL-204  |

## Skills

| id    | item                             | status  | test id                      | backlog |
| ----- | -------------------------------- | ------- | ---------------------------- | ------- |
| SK-01 | Installed table + sheet body     | app     | `skills.spec.ts › installed` | —       |
| SK-02 | Uninstall from sheet             | app     | `skills.spec.ts › uninstall` | —       |
| SK-03 | Tabs: available + sources chrome | partial | `skills.spec.ts › tabs`      | BL-206  |
| SK-04 | Available list + install         | missing | `skills.spec.ts › install`   | BL-206  |
| SK-05 | Add / sync / remove skill source | missing | `skills.spec.ts › sources`   | BL-206  |
| SK-06 | Update stale installed skill     | missing | `skills.spec.ts › update`    | BL-206  |
| SK-07 | Used-by nodes on sheet           | missing | `skills.spec.ts › used by`   | BL-206  |

## Connectors

| id    | item                                      | status | test id                              | backlog |
| ----- | ----------------------------------------- | ------ | ------------------------------------ | ------- |
| CN-01 | Table + add dialog (transport, name, how) | app    | `connectors.spec.ts › list add`      | —       |
| CN-02 | Sheet: access capabilities toggles        | app    | `connectors.spec.ts › capabilities`  | —       |
| CN-03 | Sheet: setup + remove                     | app    | `connectors.spec.ts › remove`        | —       |
| CN-04 | Sign-in / check status action             | app    | `connectors.spec.ts › sign in check` | BL-207  |
| CN-05 | Disconnect                                | app    | `connectors.spec.ts › disconnect`    | BL-207  |
| CN-06 | Used-by tab                               | app    | `connectors.spec.ts › used by`       | BL-207  |
| CN-07 | Update connector settings                 | app    | `connectors.spec.ts › update`        | BL-207  |

## Inbox

Mock at `22ff78c` only modeled approval cards. App kinds beyond that stay.

| id    | item                                           | status  | test id                             | backlog |
| ----- | ---------------------------------------------- | ------- | ----------------------------------- | ------- |
| IB-01 | Empty state                                    | app     | `inbox.spec.ts › empty`             | —       |
| IB-02 | Approval: approve / reject / note              | app     | `inbox.spec.ts › approval`          | —       |
| IB-03 | Permission allow / deny                        | app     | `inbox.spec.ts › permission`        | —       |
| IB-04 | Question answer / skip                         | app     | `inbox.spec.ts › question`          | —       |
| IB-05 | Plan review accept / reject                    | app     | `inbox.spec.ts › plan review`       | —       |
| IB-06 | Dismiss                                        | app     | `inbox.spec.ts › dismiss`           | —       |
| IB-07 | Sidebar badge from live inbox (not mock store) | app     | `shell-smoke.spec.ts › inbox badge` | BL-208  |

## Files

| id    | item                                        | status  | test id                       | backlog |
| ----- | ------------------------------------------- | ------- | ----------------------------- | ------- |
| FL-01 | Tree, search, expand/collapse, count        | app     | `files.spec.ts › tree`        | —       |
| FL-02 | Preview, markdown, edit, save               | app     | `files.spec.ts › edit save`   | —       |
| FL-03 | Reveal in Finder (`file/reveal` / host)     | app     | `files.spec.ts › reveal`      | BL-208  |
| FL-04 | `file/stat` for preview metadata            | app     | `files.spec.ts › stat`        | BL-208  |
| FL-05 | DiskPicker (shared; used by library/assets) | missing | `library.spec.ts › disk pick` | BL-205  |

## Shell / sidebar

| id    | item                                                              | status  | test id                                | backlog |
| ----- | ----------------------------------------------------------------- | ------- | -------------------------------------- | ------- |
| SH-01 | Nav: Docket, Workflows, Inbox, Files, Library, Skills, Connectors | app     | `shell-smoke.spec.ts › nav`            | —       |
| SH-02 | Runs nav item                                                     | drop    | `shell-smoke.spec.ts › no runs nav`    | BL-209  |
| SH-03 | Settings entry in sidebar footer → panel                          | missing | `sidebar-settings.spec.ts › panel`     | BL-210  |
| SH-04 | `MockShell` / `MockSidebar` / mock test ids                       | partial | `shell-smoke.spec.ts › app names`      | BL-212  |
| SH-05 | `/mock/*` redirects                                               | drop    | `shell-smoke.spec.ts › no mock routes` | BL-212  |
| SH-06 | In-memory `*-store.ts` / `*-data.ts`                              | drop    | —                                      | BL-211  |

## Settings

| id    | item                                  | status  | test id                                   | backlog |
| ----- | ------------------------------------- | ------- | ----------------------------------------- | ------- |
| ST-01 | Theme toggle (light / dark / system)  | app     | `sidebar-settings.spec.ts › theme`        | BL-210  |
| ST-02 | Open as panel (not `/settings` route) | missing | `sidebar-settings.spec.ts › panel`        | BL-210  |
| ST-03 | CLI status / trust                    | missing | `sidebar-settings.spec.ts › cli trust`    | BL-210  |
| ST-04 | Always-trust paths                    | missing | `sidebar-settings.spec.ts › always trust` | BL-210  |
| ST-05 | MCP trust allow list                  | missing | `sidebar-settings.spec.ts › mcp trust`    | BL-210  |
| ST-06 | `/settings` route                     | drop    | `sidebar-settings.spec.ts › no route`     | BL-210  |

## Counts

| status    | rows   |
| --------- | ------ |
| app       | 28     |
| partial   | 7      |
| missing   | 46     |
| drop      | 5      |
| **total** | **86** |

Phase 42 (BL-216) refreshes e2e and `layout.spec.ts` baselines so every
non-`drop` row’s test id passes.
