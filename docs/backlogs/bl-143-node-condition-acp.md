---
id: BL-143
title: Condition node on ACP
type: backlog
status: done
summary: The condition node runs an ACP session in ask mode and maps the answer to a named branch.
tags: [nodes, acp, conditions]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-142]
---

# Condition node on ACP

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/nodes.

Read-only judgement through the same runtime.

## Done when

- [x] Mode `ask`; the answer is parsed to the node's branch names; an unparsable answer fails the step with the text kept.
- [x] Fake agent tests for yes, no and unparsable.
