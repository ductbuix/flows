---
id: BL-072
title: "Command palette (later)"
type: backlog
status: blocked
summary: CommandDialog on ⌘K to go to any page, workflow, work item or run, and to start common actions. Later phase.
tags: [ui, web, dx]
related: [DES-027, DES-030]
updated: 2026-11-22
priority: P2
depends: [BL-068, BL-069, BL-070, BL-071]
---

# Command palette (later)

Retired on 2026-11-22 before the node workflow build. The status is `blocked` because the docs schema has no retired status; this file stays as history.

Design: [DES-027](../designs/des-027-ui-renovation.md) (Decisions:
Order), [DES-030](../designs/des-030-ui-renovation-journeys-dx.md)
(Shortcuts). Last phase; the docs schema has no P3, so it is P2 with
every other renovation item as a dependency.

## Done when

- [ ] `pnpm dlx shadcn@latest add command -c apps/web` ran after a
      `--dry-run`.
- [ ] ⌘K opens `CommandDialog` (input 32px, list `max-h-72`) with groups
      Pages, Workflows, Work items, Recent runs, Actions (New work item,
      Start run, Create workflow), each with readable labels.
- [ ] Shortcuts show with `CommandShortcut`; Settings lists ⌘K.
