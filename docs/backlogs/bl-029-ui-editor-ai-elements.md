---
id: BL-029
title: Editor Advanced YAML, Prompt Input and Model Selector
type: backlog
status: todo
summary: YAML pane behind Advanced, Prompt Input for prompts, and Model Selector for DES-023 model and effort.
tags: [ui, web, editor, ai-elements]
related: [DES-024, DES-010, DES-023, BL-026]
updated: 2026-11-21
priority: P1
depends: [BL-027]
---

# Editor Advanced YAML, Prompt Input and Model Selector

Design: [DES-024](../designs/des-024-ui-shadcn-baseline.md).
Depends on [BL-027](bl-027-ui-shadcn-foundation.md) for the shell
and the shared Advanced switch. If
[BL-026](bl-026-agent-model-effort-ui.md) has landed, swap its
selects for Model Selector; otherwise build them here to the
DES-023 contract. Supersedes BL-029 on the unmerged branch
`docs/des-024-ui-foundation`.

## Done when

- [ ] The YAML pane shows only with Advanced on
      (`flows-advanced`). With it off, the graph takes its
      space. A YAML parse error shows an `Alert` with a button
      that turns Advanced on.
- [ ] Edit prompt uses Prompt Input. The Inspector uses Model
      Selector for model and effort, including Default and a
      custom id. Combined judge conditions stay yaml-only.
- [ ] The graph stays React Flow, with nodes as `Card size="sm"`
      and controls as Button Group. No AI Elements graph parts.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and
      `pnpm test:e2e` pass.
- [ ] Playwright covers Advanced on and off, a parse error,
      saving a prompt through Prompt Input, and picking a model
      and effort, with video and screenshots in light and dark.
