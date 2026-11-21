---
id: BL-044
title: GitHub connector, read only
type: backlog
status: todo
summary: GitHub connector with delegated gh sign-in, one shared clone per repo, and commit revisions pinned as read-only checkouts.
tags: [engine, connections, github]
related: [DES-026]
updated: 2026-11-22
priority: P1
depends: [BL-043]
---

# GitHub connector, read only

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (First source, Pulling: big sources). Publishing
a branch and draft pull request is BL-050.

## Done when

- [ ] `describe` lists entity kind `repo` with scope `owner/name` and
      sign-in method `cli` (the GitHub CLI owns the login).
- [ ] `check` runs `gh auth status` for the host and reports signed
      in, signed out or missing CLI. Flows stores nothing.
- [ ] `pull` keeps one shared clone per repo under the library,
      fetches, and records the commit sha as the revision. A pinned
      revision is a detached checkout at that commit.
- [ ] Preflight warns that command tasks can use the ambient `gh`
      login, as DES-026 says.
- [ ] Tests run against a local bare repo; a live test is skipped
      unless `FLOWAPP_LIVE_GH=1`.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
