---
id: BL-030
title: UI polish on the shadcn baseline
type: backlog
status: todo
summary: Sidebar list states, long lists, and a final divergence sweep against shadcn defaults after the run view and editor phases.
tags: [ui, web, shadcn]
related: [DES-024, DES-013]
updated: 2026-11-21
priority: P2
depends: [BL-027, BL-028, BL-029]
---

# UI polish on the shadcn baseline

Design: [DES-024](../designs/des-024-ui-shadcn-baseline.md).
Supersedes BL-030 on the unmerged branch
`docs/des-024-ui-foundation`. A command palette is not part of
this backlog.

## Done when

- [ ] The sidebar has a `SidebarMenuSkeleton` while loading and
      an `Empty` when there are no workflows. Long lists scroll
      inside `SidebarContent` and Settings stays visible.
- [ ] Settings shows the `d` theme shortcut with `Kbd`.
- [ ] A sweep of `apps/web` finds no class that restates or
      overrides a shadcn prop (size, variant, width) and no
      hand-rolled copy of an installed component. Findings are
      fixed or listed in DES-024.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and
      `pnpm test:e2e` pass.
- [ ] Playwright covers loading, empty and long sidebar lists,
      with video and screenshots in light and dark.
