---
id: BL-052
title: Trust agent review publish policy
type: backlog
status: todo
summary: A judge agent reads the change set and approves or escalates; escalate, error, timeout or destructive ops fall back to a person.
tags: [engine, connections, agents, safety]
related: [DES-026, DES-004, DES-023]
updated: 2026-11-22
priority: P2
depends: [BL-049, BL-051]
---

# Trust agent review publish policy

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Agent review). Reuses the agent judge from
BL-011 and the model defaults of DES-023.

## Done when

- [ ] Policy `trust-agent-review` parses. The judge gets `preview.md`,
      the change set, the task goal and optional
      `connections/<id>/review.md`.
- [ ] Approve publishes with no pause. Escalate, an error, a timeout
      or any destructive op becomes the same pending publish as
      Approve each publish.
- [ ] The verdict and reason are in the effects ledger and on the run.
- [ ] Tests cover approve, escalate, timeout and destructive fallback.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
