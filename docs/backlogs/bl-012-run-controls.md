---
id: BL-012
title: Run controls and run deletion
type: backlog
status: done
summary: Start, cancel, rerun, retry, approve and reject actions and manual run deletion with confirm dialogs.
tags: [ui, web, runs, controls, engine]
related: [DES-003, DES-011]
updated: 2026-11-21
priority: P2
depends: [BL-008, BL-014]
---

# Run controls and run deletion

Design: [DES-011](../designs/des-011-run-controls.md). Engine states and
events: [DES-003](../designs/des-003-engine.md).

## Done when

- [x] Server endpoints for start, cancel, rerun, retry task and delete run,
      idempotent by request id, with zod schemas in `packages/shared`.
- [x] Each action maps to engine events and the UI updates from events.
- [x] Disabled actions explain why in a Tooltip.
- [x] Cancel and delete confirm with Alert Dialog; delete lists exactly
      what is removed and is blocked while the run is live.
- [x] Manual retry shows as `Manual retry` and does not use `retry.max`.
- [x] Cancel ends unfinished tasks and the run `cancelled`.
- [x] Approve and reject work on gated tasks; reject confirms first.
- [x] Delete appends the run deleted marker, removes the run dir, and the
      run disappears from lists; a crash between the two is finished on
      resume.
- [x] Playwright tests from DES-011 with video and screenshots.
