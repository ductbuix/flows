---
id: BL-010
title: Sandboxing
type: backlog
status: todo
summary: Restrict task writes to the workflow dir with sandbox-exec on macOS, with a warned fallback.
tags: [sandbox, security, process]
related: [DES-006, DES-007]
updated: 2026-11-20
priority: P2
depends: [BL-009]
---

# Sandboxing

Spec: [DES-006](../designs/des-006-sandboxing.md). macOS only on day one;
Linux and Windows are out of scope ([DES-007](../designs/des-007-tradeoffs.md)).

## Done when

- [ ] A task cannot write outside its workflow dir on macOS.
- [ ] When `sandbox-exec` cannot be applied, the task runs unrestricted
      and the run shows a warning badge.
- [ ] Agent CLIs get their own permission and allowed-dir flags.
