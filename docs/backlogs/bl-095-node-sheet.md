---
id: BL-095
title: Node Sheet and Trigger inputs
type: backlog
status: todo
summary: The 384px node Sheet (name, timeout, retry, memory, Delete node) and the Trigger's run inputs, moved from workflow settings.
tags: [web, editor, nodes]
related: [DES-036, DES-021, DES-028]
updated: 2026-11-22
priority: P0
depends: [BL-078]
---

# Node Sheet and Trigger inputs

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Nodes). Supersedes the Sheet part of BL-066. Layer: web only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [ ] A node's settings button opens the 384px Sheet: name, timeout, retry, memory Combobox, Delete node; Esc returns focus to the node.
- [ ] The Trigger's Sheet holds the run inputs and the 448px Edit input dialog that BL-067 no longer builds.
- [ ] Delete node removes its edges and trashes its folder through the PUT.
- [ ] Test: `apps/e2e/tests/node-sheet.spec.ts` sets a timeout, adds a Trigger input, deletes a node. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
