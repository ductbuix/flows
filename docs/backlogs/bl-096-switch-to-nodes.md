---
id: BL-096
title: Switch to node workflows
type: backlog
status: todo
summary: "Turn the node path on for everyone in one small change: the flag defaults on, e2e runs on nodes, task e2e specs are retired."
tags: [engine, server, web, rollout]
related: [DES-037, DES-031]
updated: 2026-11-22
priority: P0
depends: [BL-086, BL-087, BL-104]
---

# Switch to node workflows

Design: [DES-037](../designs/des-037-node-delivery.md) (Rollout). Touches config and tests only; no new behavior.

## Done when

- [ ] `FLOWS_NODES` defaults on; the server and web use the node path; the old path is still in the code, unused.
- [ ] Sample workflows and e2e fixtures use the node format; e2e specs that only test task behavior are deleted, the rest are moved to nodes.
- [ ] An old-format workflow shows its validation error (DES-033 Old files).
- [ ] Test: full `pnpm test` and `pnpm test:e2e` pass with the flag on; `apps/e2e/tests/node-old-file.spec.ts` sees the error for an old file.
