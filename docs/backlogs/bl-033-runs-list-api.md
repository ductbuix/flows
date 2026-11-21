---
id: BL-033
title: Runs list across workflows
type: backlog
status: done
summary: GET /runs returns a run summary for every workflow, filterable by status and workflow, without refolding all events per call.
tags: [server, engine, runs, api]
related: [DES-025, DES-003]
updated: 2026-11-22
priority: P0
depends: []
---

# Runs list across workflows

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (Runs, Home). Today only
`GET /workflows/:id/runs` exists, and `Engine.listRuns()` folds every
run's events on each call. Home and Runs read this list often, so the summary
is cached per run and updated on append.

## Done when

- [x] Shared zod `runSummarySchema`: runId, workflowId, workflow name,
      status, `needsYou` (one `{ taskId, connectionId? }` per task in
      `awaiting_approval`; publish tasks set `connectionId` later),
      task counts (done, total), first failed task id, itemKey,
      startedAt, finishedAt. Run status is unchanged:
      waiting is derived from tasks, with no new event or status.
- [x] `GET /runs` returns summaries newest first; query `status` and
      `workflowId` filter, `limit` caps (default 100). Deleted runs
      are absent.
- [x] The engine keeps a summary cache keyed by run id, updated from
      `onEvent`, rebuilt on start after resume. A test shows a second
      call folds nothing.
- [x] The websocket sends a `runs_changed` message (run id and
      summary) when any summary changes, so lists stay live without
      polling.
- [x] Server tests cover filters, deleted runs, awaiting approval and
      failed task.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
