---
id: BL-146
title: Agent permission requests in the Inbox
type: backlog
status: todo
summary: When the chain says ask, session/request_permission becomes an Inbox permission item; the answer goes back as the chosen option.
tags: [acp, inbox, permissions]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-144, BL-145, BL-138]
---

# Agent permission requests in the Inbox

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core, packages/agent-acp.

Rule 5: a person decides, and the step waits visibly.

## Done when

- [ ] Step state `waiting` while the item is open; options map to `allow-once`, `allow-always`, `reject-once`.
- [ ] Node `autoReject` timer rejects and resolves the item.
- [ ] Fake agent test: ask, answer from `inbox/answer`, agent continues.
