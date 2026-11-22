---
id: BL-088
title: Node YAML edit helpers that keep comments
type: backlog
status: todo
summary: Shared helpers to add, remove and rename a node, set a node key, and add or remove an edge, keeping comments and key order.
tags: [shared, yaml, nodes]
related: [DES-033, DES-013]
updated: 2026-11-22
priority: P0
depends: [BL-074]
---

# Node YAML edit helpers that keep comments

Design: [DES-033](../designs/des-033-workflow-file.md) (Writes). Layer: shared only; additive.

## Done when

- [ ] `packages/shared/src/nodes/yaml-edit.ts` exports add, remove and rename node, set node key, add and remove edge.
- [ ] Each helper keeps comments and key order and returns text that parses with `nodeWorkflowSchema`.
- [ ] Rename updates every edge that names the old id.
- [ ] Test: `packages/shared/src/nodes/yaml-edit.test.ts` with commented fixtures, as `workflow-yaml-edit.test.ts` does for tasks.
