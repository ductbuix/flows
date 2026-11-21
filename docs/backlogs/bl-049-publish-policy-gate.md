---
id: BL-049
title: Publish policy gate and conflicts
type: backlog
status: todo
summary: Read only and Approve each publish policies, a pending publish that waits on a person, conflict check against base, and Cloud effects.
tags: [engine, server, connections, approval, safety]
related: [DES-026, DES-014]
updated: 2026-11-22
priority: P2
depends: [BL-048]
---

# Publish policy gate and conflicts

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Safety: publish policy, Change sets and
conflicts). Trust agent review is BL-052; until then it is refused at
parse.

## Done when

- [ ] Under `read-only` no change set is published and the run says
      so. Under `approve-each-publish` a change set becomes a pending
      publish and the run waits, shown like an approval: the summary
      gets a `{ kind: publish, connectionId }` entry in `needsYou`.
- [ ] `POST /runs/:runId/publishes/:connectionId/approve` and
      `/discard`. Ops flagged `destructive` always need this approval
      whatever the policy.
- [ ] Before `publish`, Flows compares the remote revision with
      `base`. A difference is `conflict`: nothing is applied and the
      run offers pull again and rerun the task, or discard. Flows
      never merges.
- [ ] `publish` results `applied`, `conflict` or `rejected` are
      events; `applied` records a Cloud effect with the connector's
      undo note.
- [ ] Resume keeps a pending publish pending. Tests use the fake
      connector for each result and for destructive ops.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
