---
id: BL-137
title: "ACP session: initialize, new, prompt, updates"
type: backlog
status: todo
summary: "agent-acp runs a session: initialize, session/new, session/prompt, maps session/update to AgentEvent, ends on stopReason."
tags: [acp, agents]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-136]
---

# ACP session: initialize, new, prompt, updates

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp.

The core of the agent runtime over the shared JSON-RPC peer.

## Done when

- [ ] Maps `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `usage_update` and `stopReason`.
- [ ] Unknown update kinds are ignored and logged.
- [ ] Tests against the fake agent for each mapping.
