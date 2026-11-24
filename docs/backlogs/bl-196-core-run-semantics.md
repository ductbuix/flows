---
id: BL-196
title: "Move partial runs, loops, retry and resume to core"
type: backlog
status: done
summary: Partial runs, loop edges, retry, rerun, cancel and resume after restart work on the core run actor.
tags: [core, runs, resume]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: [BL-195]
---

# Move partial runs, loops, retry and resume to core

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/core.

Move `partial.ts`, loop walking, cancel and resume. Resume after a daemon restart must not rerun finished steps.

## Done when

- [x] Partial run, loop, retry and resume tests pass on core.
- [x] A killed daemon resumes a run from the event log.
