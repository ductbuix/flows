---
id: BL-074
title: Workflow file and shared node registry
type: backlog
status: todo
summary: "workflow.yaml as nodes and edges from a shared kind registry, replacing the task format in place; old keys fail validation."
tags: [shared, yaml, nodes, registry]
related: [DES-033, DES-035, DES-032, DES-013]
updated: 2026-11-22
priority: P0
depends: []
---

# Workflow file and shared node registry

Design: [DES-033](../designs/des-033-workflow-file.md),
[DES-035](../designs/des-035-node-registry.md) (Shared).

## Done when

- [ ] `packages/shared/src/nodes/` has one `defineNodeKind` file per
      kind for trigger, prompt, agent, command and output (`folder`
      target); the other kinds land with their backlogs.
- [ ] `workflowSchema` has `nodes` (union from the
      registry) and `edges` (`from`, `to`, optional `port` and
      `branch`); strict settings, unknown keys are errors.
- [ ] One port table drives edge checks: port mismatch, branch rules,
      duplicates, unknown ids. Cycles are allowed.
- [ ] Removed with no alias: `tasks`, top-level `inputs`, `needs`,
      `when`, `repeat`, `approval`, `continueOnError`, `spawn`, `uses`,
      `maxTasks`, `maxSpawnDepth`, `kind: publish`.
- [ ] `limits.loopPasses` (default 5) is in the schema.
- [ ] YAML edit helpers add, remove and rename a node, set a node key,
      and add and remove an edge, keeping comments and key order
      (fixtures as in DES-013).
- [ ] A file with old keys fails validation with a clear error that
      names the first one; there is no second format.
- [ ] Unit tests cover each kind schema, the port table and the edit
      helpers.
