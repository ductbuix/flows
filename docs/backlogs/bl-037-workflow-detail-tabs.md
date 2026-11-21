---
id: BL-037
title: "Workflow detail tabs: Overview, Editor, Runs"
type: backlog
status: done
summary: Workflow page gets Overview (tasks, inputs, Start card), Editor with a YAML tab, and Runs; the Advanced switch and its hook are removed.
tags: [ui, web, editor, workflow]
related: [DES-025, DES-024, DES-021]
updated: 2026-11-22
priority: P1
depends: [BL-032, BL-036]
---

# Workflow detail tabs: Overview, Editor, Runs

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (Pages: Workflow Overview, Editor). The Start card
reuses `StartRunForm`; asking for a work item comes in BL-041.
Connections on Overview come in BL-046.

## Done when

- [x] `/workflows/:id` shows `Tabs variant="line"`: Overview, Editor,
      Runs, driven by `tab`. Default is Overview.
- [x] Overview: Tasks (name, kind, needs), Inputs (declared inputs),
      and a Start card that embeds the existing start form and trust
      gate.
- [x] Editor: the YAML pane is a tab beside Graph instead of behind
      Advanced; the conflict dialog and save flow are unchanged.
- [x] Runs: the existing workflow run list, inside the tab.
- [x] `AdvancedSwitch`, `use-advanced` and `task-advanced` are
      deleted; nothing imports them.
- [x] Editor and run e2e pass with updated selectors; Overview
      screenshots in light and dark.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
