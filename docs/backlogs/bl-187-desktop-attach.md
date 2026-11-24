---
id: BL-187
title: Desktop attaches to a running daemon
type: backlog
status: done
summary: If engine.lock names a live owner, the desktop app connects to it over WebSocket instead of starting an engine.
tags: [desktop, electron, runtime]
related: [DES-039]
updated: 2026-11-24
priority: P2
depends: [BL-186, BL-117, BL-118]
---

# Desktop attaches to a running daemon

Design: [DES-039](../designs/des-039-system-architecture-v2.md). Layer: apps/desktop.

Never two engines on one home.

## Done when

- [x] Start with a live daemon attaches; with none or a stale lock, starts its own.
- [x] Smoke test for both paths.
