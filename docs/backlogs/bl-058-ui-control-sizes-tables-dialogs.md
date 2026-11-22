---
id: BL-058
title: "UI sizes: 32px controls, 37px rows, dialog widths by kind"
type: backlog
status: done
summary: Default 32px controls outside dense containers, one table row height, dialog widths 384/448/576, Empty and radius rules.
tags: [ui, web, layout, shadcn]
related: [DES-027, DES-029]
updated: 2026-11-22
priority: P0
depends: [BL-057]
---

# UI sizes: 32px controls, 37px rows, dialog widths by kind

Design: [DES-027](../designs/des-027-ui-renovation.md) (Spec sheet:
Surfaces and controls; Tables, dialogs, sheets, empty states). Fixes S5
to S9.

## Done when

- [x] No `size="sm"`, `xs`, `icon-sm` or `icon-xs` outside the dense
      containers listed in DES-027; header and toolbar buttons are 32px.
- [x] Tables: wrapper `overflow-hidden rounded-lg border`, header
      `bg-muted`; cells holding a Badge, Checkbox or button add `py-0`;
      every body row is 37px and every header row 41px; row actions are
      `ghost` `icon-sm` + `DropdownMenu align="end"` in the last column.
- [x] Long cells `truncate` inside `max-w-xs`; no row wraps (no 45, 53
      or 81px rows remain).
- [x] An empty list renders a section `Empty className="border"` with
      `EmptyMedia variant="icon"` instead of a Table; the sidebar uses a
      "Create workflow" menu button instead of an Empty.
- [x] Dialogs: confirm 384px (no class), form 448px (`sm:max-w-md`),
      editor 576px (`sm:max-w-xl`); deletes use `AlertDialog` at 384px;
      Rename becomes a form `Dialog`. The five dialogs whose width never
      applied are fixed.
- [x] Dialog titles are never mono; paths move to the description in
      mono.
- [x] Dialog footers: Cancel `outline` before the primary, a destructive
      extra action left with `mr-auto`, default size.
- [x] Evidence: `apps/e2e/tests/ui-sizes.spec.ts` asserts 41px header and
      37px body rows, dialog widths 384/448 and the bordered Empty, and
      writes light and dark screenshots at 1440x900 plus a video to
      `test-results/` (local only, no PR).
- [x] `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass; lint
      errors that predate this change (`set-state-in-effect`, shared
      `run-inputs.ts`) remain.
