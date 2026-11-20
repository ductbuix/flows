---
id: BL-003
title: Docs system
type: backlog
status: done
summary: designs and backlogs folders, one frontmatter schema, generated indexes, docs:check, retrieval rules.
tags: [docs, agents]
related: [DOC-001]
updated: 2026-11-20
priority: P0
depends: [BL-002]
---

# Docs system

## Scope

- `docs/README.md`: schema, retrieval and writing rules.
- `scripts/docs.mjs`: `pnpm docs:index` and `pnpm docs:check`.
- Old single design doc split into `docs/designs/`; build order chunked
  into `docs/backlogs/`.

## Done when

- [x] `pnpm docs:check` passes and runs inside `pnpm lint`.
- [x] Every file under `docs/` is under 300 lines.
