---
id: BL-096
title: Switch to node workflows
type: backlog
status: done
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

- [x] `FLOWS_NODES` defaults on; the server and web use the node path; the old path is still in the code, unused.
- [x] Sample workflows and e2e fixtures use the node format; e2e specs that only test task behavior are deleted, the rest are moved to nodes.
- [x] An old-format workflow shows its validation error (DES-033 Old files).
- [x] Test: full `pnpm test` and `pnpm test:e2e` pass with the flag on; `apps/e2e/tests/node-old-file.spec.ts` sees the error for an old file.

## Result

- The server reads the node path unless `FLOWS_NODES=0`. Server unit tests of the task path pin `FLOWS_NODES=0` in `apps/server/vitest.config.ts`; BL-098 deletes them with the path.
- The flag hid two gaps that the switch needed: the Workflows list skipped node files (it still used the task loader) and a new workflow got a task starter. The list now reads nodes (an old-format file is listed with `taskCount` 0 so its error is reachable) and a new workflow starts as one manual Trigger.
- e2e runs on one stack with node fixtures. Deleted as task-only: graph-editor, remove-task-editor, run-controls, run-view, run-view-ai-elements, trust, model-effort, editor-ai-elements, run-inputs, home-needs-you, publish-ui, connections-editor-runs, and the memory panel tests of workflow-lifecycle. The rest moved to the node `diamond` fixture.

## Open gaps carried to later items

- Trust is not enforced on node starts: preflight lists the Agent CLIs but the start route ignores the grant and "Trust always" is not saved. Needs its own item before Agent nodes are used outside this machine's allowed CLIs.
- Rerun, approve and reject are not wired for node runs (`/rerun` still loads the task format). Approve and reject arrive with BL-080; rerun has no item yet.
- Manual retry of a step works only after the run has ended.
- The memory panel (list, edit, remove, import) is only in the task Inspector; node cards pick memory files but cannot manage them. Publish, connection and model/effort e2e coverage went with the task specs; BL-084 and the Agent Sheet items restore it on nodes.
