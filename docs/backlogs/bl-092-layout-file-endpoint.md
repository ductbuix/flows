---
id: BL-092
title: "Server: layout file endpoint"
type: backlog
status: done
summary: Read and write workflow.layout.json atomically, drop orphan ids, never touch workflow.yaml; rename moves the entry.
tags: [server, api, layout]
related: [DES-033]
updated: 2026-11-22
priority: P0
depends: [BL-076]
---

# Server: layout file endpoint

Design: [DES-033](../designs/des-033-workflow-file.md) (Layout file). Layer: server only; a new route.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [x] GET and PUT `/api/workflows/:id/layout` read and write `workflow.layout.json` atomically.
- [x] Orphan ids are dropped on write; a node rename in BL-076's PUT moves its entry.
- [x] Layout writes never change `workflow.yaml` or its hash.
- [x] Test: `apps/server/src/layout-routes.test.ts`: round trip, orphans dropped, YAML hash unchanged, missing file reads as empty.
