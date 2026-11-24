---
id: BL-192
title: Daemon routes Inbox answers to live ACP sessions
type: backlog
status: done
summary: "inbox/answer for permission, question and plan_review reaches the live ACP session on the daemon."
tags: [inbox, acp, server, daemon]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-145, BL-147, BL-148]
---

# Daemon routes Inbox answers to live ACP sessions

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core
inbox, packages/engine + agent-acp hooks, apps/server `fcp-inbox`.

Gap: `pushAnswer` only handles approval and throws for permission;
question and plan-review are parked by the ACP runtime but answers never
reach the live session on the daemon.

Reuse the existing parked-request gates; no new abstractions beyond a
thin route from Inbox to those gates.

## Done when

- [x] Permission, question and plan answers from `inbox/answer` reach the
      live ACP session.
- [x] Dismiss maps to rejected/skipped (or reject-once) on the session;
      run cancel still answers ACP `cancelled`.
- [x] Answers for a session that is gone fail cleanly.
- [x] Integration test on the daemon with the fake agent.
