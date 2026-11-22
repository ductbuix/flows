---
id: BL-078
title: "Node cards: shared frame and settings on the node"
type: backlog
status: done
summary: Web node registry, the shared NodeFrame, and cards with inline settings for trigger, prompt, agent, command and output.
tags: [web, editor, nodes, registry]
related: [DES-036, DES-035]
updated: 2026-11-22
priority: P0
depends: [BL-094, BL-060]
---

# Node cards: shared frame and settings on the node

Design: [DES-036](../designs/des-036-canvas-editor-run-view.md) (Nodes), [DES-035](../designs/des-035-node-registry.md) (Web). Supersedes the card part of BL-066. Layer: web only.

Behind `FLOWS_NODES` (DES-037 Rollout): with the flag off, the app behaves exactly as today.

## Done when

- [x] `apps/web/src/nodes/` has `defineNodeView` files for the five kinds; `NodeFrame` renders header, ports, status, timer and result slots, Run step and Retry.
- [x] Cards use `Card size="sm"`, `w-72` for steps and `w-60` for inputs and flow.
- [x] Agent shows CLI and model pills and the task Textarea; Prompt shows its text; Command shows `run`; Output shows its target.
- [x] Edits write YAML through the BL-088 helpers and node files through the PUT; undo and redo cover them.
- [x] The registry test now checks all three layers.
- [x] Test: `apps/e2e/tests/node-cards.spec.ts` edits an Agent task on the card, saves, and finds it in `nodes/<id>/prompt.md`. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
