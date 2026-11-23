---
id: BL-117
title: engine.lock ownership
type: backlog
status: todo
summary: "One engine per FLOWAPP_HOME: take engine.lock with pid, URL and token, take over a stale lock, report a live owner."
tags: [engine, runtime]
related: [DES-039]
updated: 2026-11-24
priority: P0
depends: []
---

# engine.lock ownership

Design: [DES-039](../designs/des-039-system-architecture-v2.md). Layer: packages/adapters-node (new) or apps/server.

Enforce the one-writer rule before a second host (Electron, CLI) exists.

## Done when

- [ ] `acquireLock(home)` returns `{ owned }` or `{ attachTo: { url, token } }`; file mode 0600; created with `O_EXCL`.
- [ ] A lock whose pid is gone is replaced; the lock is removed on clean shutdown.
- [ ] Unit tests with a temp home, including a stale pid.
