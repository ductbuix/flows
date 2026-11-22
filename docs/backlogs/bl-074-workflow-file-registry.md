---
id: BL-074
title: Shared node kind registry, schema and port table
type: backlog
status: done
summary: New packages/shared/src/nodes/ with five kinds, the nodes and edges schema and one port table; additive, nothing uses it yet.
tags: [shared, yaml, nodes, registry]
related: [DES-033, DES-035, DES-032, DES-037]
updated: 2026-11-22
priority: P0
depends: []
---

# Shared node kind registry, schema and port table

Design: [DES-033](../designs/des-033-workflow-file.md), [DES-035](../designs/des-035-node-registry.md) (Shared). Layer: shared only.

## Done when

- [x] `packages/shared/src/nodes/` has `defineNodeKind` and one file each for trigger, prompt, agent, command and output (`folder` target only).
- [x] `nodeWorkflowSchema` parses `nodes` (union from the registry) and `edges` (`from`, `to`, optional `port` and `branch`); kind settings are strict.
- [x] One port table drives edge checks: port mismatch, branch rules, duplicates, unknown ids; cycles are allowed.
- [x] Old keys (`tasks`, `needs`, `when`, `repeat`, `approval`, `spawn`, `uses`) fail with a clear error naming the first one.
- [x] `limits.loopPasses` (default 5) is in the schema.
- [x] The existing `workflowSchema` and every caller are unchanged; `pnpm test` stays green.
- [x] Test: `packages/shared/src/nodes/nodes.test.ts` parses the DES-033 sample (minus later kinds), rejects each bad edge case and each old key.
