---
id: BL-060
title: "UI kit: add shadcn parts, realign AI Elements to the registry"
type: backlog
status: done
summary: Add popover, combobox, checkbox, hover-card, accordion; re-add trace and code-block; realign the 9 AI Element files to shadcn examples.
tags: [ui, web, shadcn, ai-elements]
related: [DES-027, DES-030, DES-008]
updated: 2026-11-22
priority: P0
depends: []
---

# UI kit: add shadcn parts, realign AI Elements to the registry

Design: [DES-027](../designs/des-027-ui-renovation.md) (shadcn
components to add),
[DES-030](../designs/des-030-ui-renovation-journeys-dx.md) (AI Elements
realigned to the registry).

## Done when

- [x] `pnpm dlx shadcn@latest add popover combobox checkbox hover-card accordion -c apps/web`
      ran after a `--dry-run`; generated files are unedited.
- [x] `trace` and `code-block` are re-added with `--overwrite`; the
      installed `shadcn/dist/tailwind.css` provides `shimmer` and
      `scroll-fade-x` (checked, or the shadcn package is upgraded).
- [x] Each file in `components/ai-elements/` starts with a source
      comment (`apps/v4/examples/base/<file>` and the shadcn commit) and
      lists any base-rhea literal changed to base-nova.
- [x] `environment-variables.tsx` moves to `components/data/`.
- [x] `/dev/kit` shows each new part and each AI Element in light and
      dark.
