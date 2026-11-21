---
id: BL-052
title: Trust agent review publish policy
type: backlog
status: done
summary: A judge agent at a publish task approves or escalates; escalate, error, timeout or destructive ops wait for a person.
tags: [engine, connections, agents, safety]
related: [DES-026, DES-004, DES-023]
updated: 2026-11-22
priority: P2
depends: [BL-049, BL-051]
---

# Trust agent review publish policy

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Agent review). Reuses the agent condition of BL-011 and
the model defaults of DES-023.

## Done when

- [x] Policy `trust-agent-review` parses. At a publish task the judge
      gets `preview.md`, the change set, the goals of the `propose`
      tasks and optional `connections/<id>/review.md`.
- [x] Approve publishes with no pause. Escalate, an error, a timeout or
      any destructive op puts the task in `awaiting_approval`, as under
      Approve each publish.
- [x] The verdict and reason are in the effects ledger and on the task.
- [x] Tests cover approve, escalate, timeout and destructive fallback.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
