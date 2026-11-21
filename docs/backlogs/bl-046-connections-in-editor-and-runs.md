---
id: BL-046
title: Connections in the editor, work item context and run pins
type: backlog
status: done
summary: Inspector Connections FieldSet and node badges, Overview impact, work item Context with freshness, and Library pins on the run view.
tags: [ui, web, editor, connections, work-items]
related: [DES-025, DES-026]
updated: 2026-11-22
priority: P1
depends: [BL-037, BL-040, BL-045]
---

# Connections in the editor, work item context and run pins

Design: [DES-025](../designs/des-025-journey-led-redesign.md) (J6, J8, J10, Pages: Editor, Work item, Run view).
`propose` stays disabled in the FieldSet until BL-051.

## Done when

- [x] Inspector has a Connections FieldSet: add a connection to the
      task with access Read; Propose changes shows disabled with a
      `FieldDescription`. Saving writes `uses` and keeps YAML
      comments.
- [x] Graph nodes show an outline Badge per connection the task uses.
- [x] Overview lists Connections and impact for the workflow.
- [x] Work item Context links library entities (pick from the Library)
      and shows Freshness; links are saved in `workitem.yaml` and
      pulled and pinned at run start (BL-043). A work
      item can be created from a library entity, which sets its source
      Badge.
- [x] Run view shows Library pins: entity, revision, Freshness, used
      by task.
- [x] e2e covers J8: two tasks using different connections, pins
      visible on the run.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
