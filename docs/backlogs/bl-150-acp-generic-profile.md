---
id: BL-150
title: Generic ACP profile
type: backlog
status: todo
summary: A profile that uses only spec ACP methods, configured by command and args, so any ACP agent can run.
tags: [acp, agents]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-137]
---

# Generic ACP profile

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp/profiles.

Proves the runtime is not Cursor-only.

## Done when

- [ ] Profile settings: command, args, env names, optional auth method.
- [ ] Extensions are ignored with a log line.
- [ ] Fake agent test with no Cursor extension calls.
