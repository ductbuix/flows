---
id: BL-169
title: Install and uninstall skills from a source
type: backlog
status: todo
summary: skill/install copies a skill from a source into .agents and .claude and records from; uninstall removes the copies.
tags: [skills, fcp]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-168]
---

# Install and uninstall skills from a source

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/skills.

Install keeps a copy; later source updates never touch it.

## Done when

- [ ] `from: { sourceId, version }` recorded; installing over an existing slug asks via `conflict`.
- [ ] Tests on fakes.
