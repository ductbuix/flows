---
id: BL-050
title: GitHub publish as a branch and draft pull request
type: backlog
status: todo
summary: The GitHub connector diffs a work copy into a branch change set and publishes it as a pushed branch with a draft pull request.
tags: [engine, connections, github]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-044, BL-049]
---

# GitHub publish as a branch and draft pull request

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (First source).

## Done when

- [ ] `diff` builds one op per change set: push branch
      `flows/<runId>/<taskId>` and open a draft pull request, with the
      unified diff as payload.
- [ ] `publish` pushes with `gh` and opens the draft pull request; the
      undo note says how to close it and delete the branch.
- [ ] A base commit that moved on the remote returns `conflict`. Force
      push is flagged `destructive`.
- [ ] Tests against a local bare repo with `gh` stubbed; a live test
      is skipped unless `FLOWAPP_LIVE_GH=1`.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
