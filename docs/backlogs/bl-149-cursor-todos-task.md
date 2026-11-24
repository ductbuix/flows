---
id: BL-149
title: Cursor todos and subagent traces
type: backlog
status: done
summary: cursor/update_todos becomes a todos run update; cursor/task adds a subagent trace row under the step.
tags: [cursor, acp, runs]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-141]
---

# Cursor todos and subagent traces

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/agent-acp/profiles.

Show progress the agent already reports.

## Done when

- [x] `merge: true` merges todos by id, `false` replaces.
- [x] Trace rows carry description, subagent type and duration.
- [x] Fake agent test.
