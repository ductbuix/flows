---
id: BL-039
title: Runs carry a work item id
type: backlog
status: done
summary: Start and rerun accept workItemId; run_started, inputs.json and run summaries record it; the duplicate check warns per work item.
tags: [engine, server, runs, work-items]
related: [DES-026, DES-021]
updated: 2026-11-22
priority: P1
depends: [BL-038, BL-033]
---

# Runs carry a work item id

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Work items) and [DES-025](../designs/des-025-journey-led-redesign.md) (Resolved questions: Start
card inputs). The run keeps the values submitted; the work item's own
values never change from a run.

## Done when

- [x] The start body accepts optional `workItemId`; an unknown id is
      400 `unknown_work_item`.
- [x] `run_started`, `inputs.json` and `runSummarySchema` carry
      `workItemId`. Older events without it still fold.
- [x] When `workItemId` is set the item key is derived from it, so the
      409 `duplicate_input` warns per work item and workflow. Ad hoc
      runs keep today's key.
- [x] Rerun keeps the original `workItemId`. `GET /runs?workItemId=`
      filters.
- [x] Engine and server tests cover start, rerun, duplicate per item,
      filter and folding old events.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
