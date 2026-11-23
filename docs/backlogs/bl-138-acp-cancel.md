---
id: BL-138
title: ACP cancel
type: backlog
status: todo
summary: Aborting a prompt sends session/cancel, answers pending permission requests with cancelled and ends with stop cancelled.
tags: [acp, agents, cancellation]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-137, BL-106]
---

# ACP cancel

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp.

Run cancel and step timeout must stop an agent the ACP way.

## Done when

- [ ] Abort sends `session/cancel { sessionId }`; pending `session/request_permission` get outcome `cancelled`.
- [ ] If the agent does not stop within a grace period the process group is killed.
- [ ] Fake agent tests for both paths.
