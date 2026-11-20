---
id: BL-005
title: Resume after restart
type: backlog
status: done
summary: Replay the log on start, re-attach or interrupt open attempts, never rerun finished tasks.
tags: [engine, resume, events]
related: [DES-003]
updated: 2026-11-21
priority: P0
depends: [BL-004]
---

# Resume after restart

Resume rules are in [DES-003](../designs/des-003-engine.md) (engine step 4
and 5).

## Done when

- [x] Kill the engine mid-run, restart it, and the run completes.
- [x] Finished tasks are not rerun.
- [x] A started attempt with no exit is re-attached by pid if alive, else
      recorded `interrupted` and handled by the retry policy.
- [x] Covered by a test that kills and restarts the engine process.
