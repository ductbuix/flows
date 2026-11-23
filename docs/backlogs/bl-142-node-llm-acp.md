---
id: BL-142
title: LLM node on ACP
type: backlog
status: todo
summary: The llm node runs as an ACP session in agent mode when setting agents.runtime is acp; the spawn path stays the default.
tags: [nodes, acp, agents]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-134, BL-140]
---

# LLM node on ACP

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/nodes.

Switch one node kind to the new runtime behind a setting (DES-039 M4).

## Done when

- [ ] Prompt plus input files as `resource` blocks; output text written to the step output.
- [ ] `agents.runtime=spawn` keeps today's behaviour.
- [ ] Engine test with the fake agent; e2e with a fake agent profile.
