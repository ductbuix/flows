---
id: BL-189
title: Desktop host capabilities
type: backlog
status: todo
summary: The desktop client declares host.revealPath and host.notifications and implements host/reveal_path and OS notifications for Inbox items.
tags: [desktop, electron, fcp]
related: [DES-040]
updated: 2026-11-24
priority: P2
depends: [BL-186]
---

# Desktop host capabilities

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: apps/desktop.

Use what only a desktop app can do, through capabilities.

## Done when

- [ ] Reveal opens Finder at the path; new Inbox items post a notification when the window is not focused.
- [ ] Smoke test for reveal via a stubbed shell.
