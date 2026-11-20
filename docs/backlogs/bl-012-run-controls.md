---
id: BL-012
title: Run controls and run deletion
type: backlog
status: todo
summary: Start, cancel, rerun and retry-task actions and manual run deletion with confirm dialogs.
tags: [ui, web, runs, controls, engine]
related: [DES-003, DES-011]
updated: 2026-11-21
priority: P2
depends: [BL-008]
---

# Run controls and run deletion

Design: [DES-011](../designs/des-011-run-controls.md). Needs the engine
answers listed in DES-007 (cancelled state, how a deleted run leaves the
event log) before the engine side starts.

## Done when

- [ ] Server endpoints for start, cancel, rerun, retry task and delete run,
      idempotent by request id, with zod schemas in `packages/shared`.
- [ ] Each action maps to engine events and the UI updates from events.
- [ ] Disabled actions explain why in a Tooltip.
- [ ] Cancel and delete confirm with Alert Dialog; delete lists exactly
      what is removed and is blocked while the run is live.
- [ ] Manual retry shows as `Manual retry` and does not use `retry.max`.
- [ ] Playwright tests from DES-011 with video and screenshots.
