---
id: BL-095
title: Node Sheet and Trigger inputs
type: backlog
status: done
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

- [x] A node's settings button opens the 384px Sheet: name, timeout, retry, memory Combobox, Delete node; Esc returns focus to the node.
- [x] The Trigger's Sheet holds the run inputs and the 448px Edit input dialog that BL-067 no longer builds.
- [x] Delete node removes its edges and trashes its folder through the PUT.
- [x] Test: `apps/e2e/tests/node-sheet.spec.ts` sets a timeout, adds a Trigger input, deletes a node. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.

## Notes

- The node editor has no workflow settings Sheet yet, so nothing was removed there; the Trigger Sheet is the only place that edits `inputs`.
- The Sheet shows the fields a kind declares in `NODE_KINDS` (timeout and retry on Agent and Command, memory on Agent, inputs on Trigger); the Edit input dialog applies on Done so the draft YAML never holds an invalid input.
- Layout baselines (BL-061) cover no node editor screen and no flag-off screen changed, so none needed a refresh.
