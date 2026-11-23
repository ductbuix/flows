---
id: BL-172
title: Library pull as a job with versions
type: backlog
status: todo
summary: library/pull runs a provider fetch through a connector and writes an immutable v<n> folder; job_progress and job_finished updates.
tags: [library, connectors]
related: [DES-041]
updated: 2026-11-24
priority: P2
depends: [BL-171, BL-161, BL-130]
---

# Library pull as a job with versions

Design: [DES-041](../designs/des-041-engine-core.md). Layer: packages/core/library.

Port today's library pull to the new core with versions.

## Done when

- [ ] New version only when content changed; `current` is newest unless pinned.
- [ ] Service tests on fakes.
