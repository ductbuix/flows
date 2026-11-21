---
id: BL-036
title: "Run view: Tabs instead of Advanced, waiting first"
type: backlog
status: done
summary: Task Tabs (Output, Terminal, Attempts, Environment) replace the Advanced switch; Confirmation or failure Alert lead the page.
tags: [ui, web, runs, ai-elements]
related: [DES-025, DES-024]
updated: 2026-11-22
priority: P1
depends: [BL-031, BL-032]
---

# Run view: Tabs instead of Advanced, waiting first

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (Modes, J4, J5, Pages: Run view). Changes to
publish, Effects and Library pins come with BL-046 and BL-051.
`useAdvanced` stays until BL-037 removes the editor's use.

## Done when

- [x] The run view no longer renders `AdvancedSwitch`. Env and raw
      logs live in task Tabs (`variant="line"`): Output, Terminal,
      Attempts, Environment, shown for every user.
- [x] Order on the page: Confirmation (awaiting approval) or a
      destructive Alert (failed, with the failed task and a link to
      its Terminal tab), then `Progress`, then Plan beside the task
      Table, then the selected task Card.
- [x] The selected tab is a search param, so a link can open a task's
      Terminal (J5).
- [x] Existing run view e2e pass with selectors updated; new
      screenshots in light and dark for awaiting approval and failed.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
