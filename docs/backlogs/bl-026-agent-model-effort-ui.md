---
id: BL-026
title: Model and effort selects in the editor
type: backlog
status: done
summary: Drawer and workflow-default selects for model and effort, with CLI defaults as the first option, and attempts showing the resolved values.
tags: [ui, web, editor, agents]
related: [DES-023, DES-009, DES-010]
updated: 2026-11-21
priority: P0
depends: [BL-025]
---

# Model and effort selects in the editor

Design: [DES-023](../designs/des-023-model-effort.md).
Depends on [BL-025](bl-025-agent-model-effort.md) for the schema,
the catalog API, and the attempt fields.

## Done when

- [x] After the CLI select, the drawer has Model and Effort
      selects. The first option is "Default (haiku)" (or
      "Default" / "Default (auto)" when that is what the catalog
      provides). Effort options come from the chosen model.
      A custom model id is allowed. (Model Selector in BL-029)
- [x] Changing `cli` keeps the current values. If they are not
      in the new catalog, they stay as a custom value.
- [x] The workflow inspector (no node selected) has an Agent
      defaults section, grouped by Claude and Cursor, with the
      same selects. (BL-029)
- [x] When `when`, `repeat.until`, or a need's `when` is a lone
      agent leaf, the drawer shows Model and Effort on that
      leaf. Combined conditions stay yaml-only.
- [x] The run view shows the recorded model, effort, and source
      on each attempt.
- [x] Playwright covers the default option, picking a model and
      effort, a custom id, workflow defaults, a lone judge leaf,
      and the attempt row, with video and screenshots.
