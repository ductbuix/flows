---
id: BL-206
title: "Skill sources"
type: backlog
status: done
summary: Add and remove skill sources and update installed skills, as in the mock.
tags: [web, skills]
related: [DES-043]
updated: 2026-11-24
priority: P2
depends: [BL-193]
---

# Skill sources

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: apps/web.

Rebuild `SkillSources` on `skill/install`, `skill/uninstall` and `skill/update`. Show which nodes use a skill.

## Done when

- [x] Add a source and install a skill from it.
- [x] Update shows the new version.
- [x] e2e covers install and uninstall.
