---
id: BL-148
title: cursor/create_plan with plan review
type: backlog
status: done
summary: "Node setting planReview: auto accepts a Cursor plan, ask turns it into an Inbox item."
tags: [cursor, acp, inbox]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-140, BL-145]
---

# cursor/create_plan with plan review

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp/profiles, packages/core/nodes.

Let a person approve the agent's plan before it acts, when the node asks for it.

## Done when

- [x] `planReview: auto | ask` in the llm node settings (default auto).
- [x] Plan and todos visible in the item; accepted or rejected goes back to the agent.
- [x] Fake agent tests for both modes.
