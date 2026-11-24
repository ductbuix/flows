---
id: BL-195
title: "Move node executors to core"
type: backlog
status: doing
summary: Command, Agent, LLM, Judge, Approval, Output, Asset and Trigger executors run on core ports.
tags: [core, nodes, executors]
related: [DES-043]
updated: 2026-11-24
priority: P0
depends: [BL-194]
---

# Move node executors to core

Design: [DES-043](../designs/des-043-v2-completion-plan.md). Layer: packages/core.

Port each executor from `packages/engine/src/nodes/` to `core/nodes` behind ports. Keep the existing tests and move them with the code.

## Done when

- [x] Trigger, prompt, asset, command, approval, output notify/folder, and judge `mode: check` run on the core host.
- [x] Agent and llm NodeKinds exist on core with ACP + fake tests; host injects `createAcpRuntime`.
- [ ] llm, agent, and judge rule mode are host-eligible (blocked on ACP inbox gates on the live RunActor).
- [ ] Output `publish` has a core executor behind a connector/work-copy port (still engine).
- [x] Core kind tests pass on fakes (prompt, agent, folder write_output; existing asset/llm/judge/approval/notify).
- [ ] Engine executor tests for publish (and full CLI agent settle/memory) moved onto core fakes.

## Notes

- Loops stay off the core host (`findLoopEdges`); partial/retry/resume/queue remain BL-196.
- Agent on core uses ACP (`agent-acp`); engine CLI shell settle (answer.json, memories) is not fully ported.
- Keep llm/agent/judge-rule on the engine until `handlePermission` / ask gates park on the core actor.
