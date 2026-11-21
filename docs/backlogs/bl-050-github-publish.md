---
id: BL-050
title: GitHub publish as a branch and draft pull request
type: backlog
status: done
summary: The GitHub connector turns a repo work copy into a pushed branch and a draft pull request, with conflict meaning a clashing branch.
tags: [engine, connections, github]
related: [DES-026]
updated: 2026-11-22
priority: P2
depends: [BL-044, BL-049]
---

# GitHub publish as a branch and draft pull request

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (First source, Change sets and conflicts).

## Done when

- [x] `diff` commits any uncommitted work and builds one op: push branch
      `flows/<runId>/<publishTaskId>` and open a draft pull request,
      with the unified diff as payload.
- [x] `publish` pushes with `gh` and opens the draft pull request;
      `result.json` holds the branch and URL, and the undo note says
      how to close it and delete the branch.
- [x] A remote branch of that name with other commits is `conflict`.
      A moved default branch is not. Force push is flagged
      `destructive`.
- [x] Tests against a local bare repo with `gh` stubbed; a live test is
      skipped unless `FLOWAPP_LIVE_GH=1`.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
