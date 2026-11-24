---
id: BL-112
title: Branded ids
type: backlog
status: done
summary: Branded zod ids (CardId, RunId, WorkflowId, StepId, ConnectorId, SkillSlug, LibItemId) in contracts for new code.
tags: [contracts, types]
related: [DES-042]
updated: 2026-11-24
priority: P1
depends: [BL-110]
---

# Branded ids

Design: [DES-042](../designs/des-042-engine-patterns-standards.md). Layer: packages/contracts.

Add branded id schemas so new signatures cannot mix ids. Existing code is not migrated in this item.

## Done when

- [x] Each id is `z.string().regex(...).brand<...>()` with the slug rules already used for that entity.
- [x] Type test: passing a `RunId` where a `CardId` is expected fails to compile.
