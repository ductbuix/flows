---
id: BL-136
title: AgentRuntime port and a scripted fake ACP agent
type: backlog
status: done
summary: AgentRuntime port in core, plus a fake ACP agent process that replays a JSON-RPC script for tests.
tags: [acp, agents, testing]
related: [DES-041, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-107, BL-113]
---

# AgentRuntime port and a scripted fake ACP agent

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/ports, packages/agent-acp (new).

Testing first: every ACP item after this one tests against the fake, never a real CLI.

## Done when

- [x] `AgentRuntime`, `AgentSession`, `AgentEvent` types in core (DES-041).
- [x] `agent-acp/testing/fake-agent.ts` reads a script (expected requests, replies, notifications) and runs over stdio.
- [x] Self test: a scripted `initialize` round trip passes.
