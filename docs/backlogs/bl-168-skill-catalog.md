---
id: BL-168
title: Skill catalog
type: backlog
status: done
summary: Scan .agents, .claude and .cursor in workspace and home for SKILL.md folders; skill/list and skill/get over FCP; invalid skills flagged.
tags: [skills, fcp]
related: [DES-041]
updated: 2026-11-24
priority: P1
depends: [BL-126, BL-115]
---

# Skill catalog

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/skills.

Back the Skills mockup page with discovery only.

## Done when

- [x] One entry per slug with every dir that holds a copy; a skill without a description has `problem`.
- [x] `skill/update skills_changed` on file change.
- [x] Tests with fixture folders.
