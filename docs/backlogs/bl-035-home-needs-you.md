---
id: BL-035
title: Home with Needs you, Running and Recent runs
type: backlog
status: done
summary: Home lists approvals waiting on a person, running runs and recent runs, and a first launch shows one clear create action.
tags: [ui, web, home, runs]
related: [DES-025]
updated: 2026-11-22
priority: P0
depends: [BL-031, BL-033]
---

# Home with Needs you, Running and Recent runs

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (J1, J4, Pages: Home). Needs you holds approvals
now; waiting publish tasks (BL-051) and expired sign-ins (BL-045) join it
later. Work items on Home come with BL-041.

## Done when

- [x] Section "Needs you" lists each `needsYou` approval entry as a
      Confirmation with the workflow, run and task name, and Approve
      and Reject that call the existing endpoints. Empty hides the
      section.
- [x] Section "Running" lists live runs with `Progress` (done tasks
      over total); "Recent runs" lists the last 10 finished runs.
- [x] With no workflows, Home shows one `Empty` with a single "Create
      workflow" action that opens the existing dialog.
- [x] Sections update live from `runs_changed`.
- [x] e2e: a gated task appears in Needs you and approving it from
      Home runs the task. Screenshots in light and dark.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
