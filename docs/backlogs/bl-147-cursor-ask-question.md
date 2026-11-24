---
id: BL-147
title: cursor/ask_question as an Inbox question
type: backlog
status: done
summary: The Cursor extension ask_question creates an Inbox question item; the answer returns answered or skipped.
tags: [cursor, acp, inbox]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-140, BL-145]
---

# cursor/ask_question as an Inbox question

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp/profiles.

Agents can ask a person mid-step without failing the step.

## Done when

- [x] Questions and options shown as one item; multi-select honoured.
- [x] Cancel of the run answers `cancelled`.
- [x] Fake agent test.
