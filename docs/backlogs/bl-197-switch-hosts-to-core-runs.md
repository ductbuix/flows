---
id: BL-197
title: "Switch daemon, CLI and desktop to core runs"
type: backlog
status: done
summary: All hosts start and follow runs through core; the engine run path is unused and deleted.
tags: [server, cli, desktop, runs]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: [BL-196]
---

# Switch daemon, CLI and desktop to core runs

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/server, apps/cli, apps/desktop.

Remove calls to `runNodes` and `resumeNodes`. `flows run`, the daemon and the desktop host share one run path.

## Done when

- [x] `git grep runNodes` finds nothing outside deleted code.
- [x] `pnpm test:e2e` and the desktop smoke pass.
