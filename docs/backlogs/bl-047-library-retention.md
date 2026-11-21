---
id: BL-047
title: Library retention and size cap
type: backlog
status: todo
summary: Unpinned revisions cleared after 7 days, current always kept, a size cap with a warning at 80 percent, and clear entity.
tags: [engine, library, retention]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-043]
---

# Library retention and size cap

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Retention).

## Done when

- [ ] A sweep on start and every hour removes revisions not pinned by
      any run and older than 7 days; `current` is never removed.
- [ ] `config.yaml` `library.maxBytes` (default 5 GB). At 80 percent
      the Library tab shows a warning Alert; at the cap a pull fails
      with a clear message and nothing pinned is deleted.
- [ ] A repo's shared clone keeps `gc.auto=0`; the sweep runs
      `git gc --prune` on it only when no live run has a work copy of
      that repo.
- [ ] Deleting a run releases its pins. `POST /library/clear` removes
      an entity's unpinned revisions and never touches a work item.
- [ ] Tests cover pinned kept, current kept, age sweep, cap reached
      and run deletion.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
