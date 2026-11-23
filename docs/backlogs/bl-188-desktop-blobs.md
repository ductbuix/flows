---
id: BL-188
title: flows-blob protocol in Electron
type: backlog
status: todo
summary: A custom flows-blob:// protocol streams BlobStore files to the renderer; uploads pass a local path checked by main.
tags: [desktop, electron, files]
related: [DES-040]
updated: 2026-11-24
priority: P2
depends: [BL-186, BL-130]
---

# flows-blob protocol in Electron

Design: [DES-040](../designs/des-040-flows-client-protocol.md). Layer: apps/desktop.

Images and assets without an HTTP server.

## Done when

- [ ] Unknown or out-of-scope blob ids return 404.
- [ ] Smoke test shows a card image.
