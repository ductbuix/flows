---
id: BL-186
title: Electron app with an in-process engine
type: backlog
status: done
summary: "apps/desktop: Electron main starts the engine in a utilityProcess and the renderer (web build) talks FCP over a MessagePort."
tags: [desktop, electron]
related: [DES-039, DES-040]
updated: 2026-11-24
priority: P2
depends: [BL-109, BL-116, BL-122]
---

# Electron app with an in-process engine

Design: [DES-039](../designs/des-039-system-architecture-v2.md), [DES-040](../designs/des-040-flows-client-protocol.md). Layer: apps/desktop (new).

Prove the engine runs without the daemon.

## Done when

- [x] Preload exposes only `connect(): MessagePort` through `contextBridge`; `contextIsolation` on, `nodeIntegration` off.
- [x] The web build gets a transport switch: MessagePort in Electron, WebSocket in the browser.
- [x] Playwright Electron smoke: app opens, Docket lists fixture cards.
