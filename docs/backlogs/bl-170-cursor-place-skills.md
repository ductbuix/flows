---
id: BL-170
title: Node skills placed for Cursor
type: backlog
status: todo
summary: The Cursor profile copies the llm node's selected skills into the work dir layout Cursor reads.
tags: [cursor, skills, acp]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-140, BL-168]
---

# Node skills placed for Cursor

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp/profiles.

A step sees exactly the skills its node lists.

## Done when

- [ ] Only selected skills are placed; the work dir is cleaned after the step.
- [ ] Test checks the placed files.
