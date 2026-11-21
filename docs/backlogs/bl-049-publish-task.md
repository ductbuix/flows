---
id: BL-049
title: Publish task kind and policy gate
type: backlog
status: todo
summary: "kind: publish tasks build a change set, wait for approval under the policy, publish, and fail on conflict; destructive ops always wait."
tags: [engine, server, connections, approval, safety]
related: [DES-026, DES-011, DES-014]
updated: 2026-11-22
priority: P2
depends: [BL-048]
---

# Publish task kind and policy gate

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Publish tasks, Change sets and conflicts). Trust agent
review is BL-052; until then that policy is refused at parse.

## Done when

- [ ] `taskSchema` accepts `kind: publish` with `connection` and the
      usual `needs`, `when` and `name`. Validation fails for a
      `read-only` connection or no earlier `propose` task on it.
- [ ] When its needs are done, the task builds
      `changes/<taskId>/changeset.json` and `preview.md`. An empty
      change set succeeds with nothing sent.
- [ ] Under `approve-each-publish`, and for any `destructive` op, the
      task enters `awaiting_approval`; the run summary's `needsYou`
      entry carries the connection. Approve and Reject use the existing
      endpoints; Reject fails the task with reason `rejected`.
- [ ] `applied` writes `result.json` to the task's `out/`, records a
      Cloud effect with the undo note, and moves the work copy's base.
      `conflict` and `rejected` fail the task with that reason.
- [ ] Resume keeps a waiting publish task waiting and never publishes
      twice: a `publish_started` event without a result is checked
      with the connector before retrying.
- [ ] Tests use the fake connector for each result, destructive ops,
      a second publish task sending only newer changes, and resume.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
