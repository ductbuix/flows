---
id: BL-191
title: flows CLI
type: backlog
status: todo
summary: "apps/cli: flows engine --stdio serves FCP on stdio; flows run <workflow> --card <id> starts a run and streams it."
tags: [cli, fcp]
related: [DES-039, DES-040]
updated: 2026-11-24
priority: P2
depends: [BL-107, BL-120, BL-176]
---

# flows CLI

Design: [DES-039](../designs/des-039-system-architecture-v2.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: apps/cli (new).

A third host that proves the protocol is UI-agnostic.

## Done when

- [ ] Attaches to a live daemon by lock file, else runs in-process for the run.
- [ ] `flows inbox` lists open items; exit code reflects the run result.
- [ ] Integration test against a temp home.
