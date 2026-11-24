---
id: BL-144
title: Permission policy chain
type: backlog
status: done
summary: Pure chain of permission rules (path, connector capability, node allowlist, remembered answer) returning allow, reject or ask.
tags: [security, permissions, core]
related: [DES-041, DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-113]
---

# Permission policy chain

Design: [DES-041](../designs/des-041-engine-core.md), [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/core/agents.

One ordered, testable place for safety rules (DES-041 rules 1-4).

## Done when

- [x] `decidePermission(request, context) -> allow_once | allow_always | reject | ask` with the rule that decided.
- [x] `allow_always` memory is per workflow and tool, stored in settings.
- [x] Table tests for each rule and their order.
