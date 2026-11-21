---
id: BL-027
title: shadcn Sidebar shell, Settings, alignment and lint guard
type: backlog
status: todo
summary: Sidebar shell and Settings from shadcn, our components aligned to base-nova defaults, and a lint guard in apps/web.
tags: [ui, web, shadcn, lint]
related: [DES-024, DES-008, DES-019, DES-023]
updated: 2026-11-21
priority: P0
depends: []
---

# shadcn Sidebar shell, Settings, alignment and lint guard

Design: [DES-024](../designs/des-024-ui-shadcn-baseline.md).
Supersedes BL-027 on the unmerged branch
`docs/des-024-ui-foundation` (tokens and density), which is not
on `develop`.

## Done when

- [ ] `sidebar` (with `sheet` and `use-mobile`) is added with
      `shadcn add`, unedited. `shadcn add <all> --dry-run` in
      `packages/ui` lists only identical files or `"use client"`
      noise. `globals.css` is not hand-edited.
- [ ] The shell is `SidebarProvider`, `Sidebar` and
      `SidebarInset`. The sidebar lists workflows, creates one
      from `SidebarGroupAction`, renames and deletes from a
      `SidebarMenuAction` menu (existing dialogs), and links to
      Settings in `SidebarFooter`. No runs list, no icon-only
      mode. The old `nav w-44`, `-m-6` and `calc(100svh...)`
      layout hacks are gone, and `Toaster` is mounted once.
- [ ] Every page uses the same header: `SidebarTrigger`,
      `Separator`, `Breadcrumb`, then actions. The index route
      is an `Empty` ("Select a workflow or create one").
- [ ] `/settings` has theme (light default, dark, system; `d`
      still toggles), read-only CLI info as `Item` and `Badge`
      (model and effort from DES-023 when its API exists), and
      always-trust with revoke, moved from the home page. The
      app never writes CLI settings files.
- [ ] Every row of the DES-024 divergence inventory is fixed as
      listed there, except the rows marked for phase 2 or 3,
      which only get the "now" fix. In particular the five
      dialogs use `sm:max-w-*` and are visibly wider than 24rem
      at 1280px.
- [ ] `apps/web/eslint.config.js` has a core
      `no-restricted-syntax` rule that fails arbitrary utility
      values and palette colors in class strings, with a unit
      test of allowed (`data-[state=open]:`, `min-h-40`) and
      banned (`min-h-[160px]`, `text-amber-700`) samples.
      `packages/ui/src/components` is not covered. `pnpm lint`
      is green.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.
- [ ] Playwright covers the sidebar list, create from the
      sidebar, rename and delete from the row menu, Settings
      (theme, CLI info, revoke), and the wide dialogs, with
      video and screenshots in light and dark.
