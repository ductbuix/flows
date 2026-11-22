---
id: BL-076
title: "Server: node workflow GET and PUT behind a flag"
type: backlog
status: done
summary: Behind FLOWS_NODES, GET and PUT read and write node workflows, create node files, and trash removed node folders.
tags: [server, api, nodes]
related: [DES-033, DES-013, DES-022, DES-037]
updated: 2026-11-22
priority: P0
depends: [BL-074, BL-088]
---

# Server: node workflow GET and PUT behind a flag

Design: [DES-033](../designs/des-033-workflow-file.md) (Writes, Old files), [DES-037](../designs/des-037-node-delivery.md) (Rollout). Layer: server only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [x] `FLOWS_NODES=1` selects the node schema for workflow GET and PUT; with it off, today's routes and tests are unchanged.
- [x] PUT diffs node ids, moves a removed node's folder to `nodes/.trash/<id>-<stamp>/`, creates node files from the kind's `files`, and moves the folder on rename.
- [x] PUT keeps the `baseHash` conflict check (`workflow-files.ts`).
- [x] A file with old keys returns its validation error like any invalid file.
- [x] Test: `apps/server/src/node-workflow-files.test.ts`: PUT, trash, rename, conflict, old keys error, and flag off unchanged.
- [x] Rename is a hint: PUT takes optional `renames: [{from, to}]` (a full YAML cannot show one). Only required node files are created; optional ones are left to the editor.
