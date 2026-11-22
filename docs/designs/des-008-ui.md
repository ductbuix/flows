---
id: DES-008
title: UI instructions
type: ui
status: active
summary: UI system (shadcn preset on Base UI), component sourcing order, API access, test ids and evidence.
tags: [ui, web, shadcn, ai-elements, testing]
related: [DES-001, DES-009, DES-010, DES-024, DES-027, DES-030]
updated: 2026-11-22
---

# UI instructions

> Superseded in part by the UI renovation (draft, lands with BL-057 to BL-072): "Screens"; see [DES-027](des-027-ui-renovation.md). Evidence also needs the layout check in [DES-030](des-030-ui-renovation-journeys-dx.md).

## System

- shadcn initialised with preset `b1HvWXNDFK`, Vite template, monorepo
  layout. Style `base-nova` on Base UI (not Radix), base color `neutral`,
  lucide icons.
- Tailwind 4. Theme tokens (light and `.dark`) and fonts (Geist for text,
  Figtree for headings) live in `packages/ui/src/styles/globals.css`.
  Use the tokens (`bg-background`, `text-muted-foreground`, ...), not raw
  colors.
- `ThemeProvider` in `apps/web/src/components/theme-provider.tsx` handles
  light, dark and system; pressing `d` toggles the theme.
- Merge classes with `cn()` from `@workspace/ui/lib/utils`.
- shadcn defaults are the only style source: no arbitrary `-[...]`
  values or palette colors in `apps/web`, no hand edits to generated
  components, and no class that restates a `variant` or `size`
  ([DES-024](des-024-ui-shadcn-baseline.md)).

## Component sourcing

Use the first that fits, and compose before writing custom UI:

1. Components already in `packages/ui/src/components`.
2. shadcn components: https://ui.shadcn.com/docs/components.md
3. AI Elements patterns for agent UI (chat, reasoning, tool calls, plan,
   task, terminal, test results, file tree, subagent):
   https://ui.shadcn.com/docs/ai-elements.md

Add a component from the repo root:

```sh
pnpm dlx shadcn@latest add <name> -c apps/web --dry-run   # preview
pnpm dlx shadcn@latest add <name> -c apps/web
```

Primitives land in `packages/ui/src/components` (import as
`@workspace/ui/components/<name>`); some items also add hooks or libs in
`apps/web/src`. AI Elements have no package: add the parts they build on
(for example `trace code-block`), then copy the pattern from
`https://ui.shadcn.com/docs/ai-elements/base/<pattern>.md` into
`apps/web/src/components/ai-elements/`.

## Data

- Call the server only through the typed client in
  `apps/web/src/lib/api.ts` (`hc<AppType>`). Vite proxies `/api` and the
  websocket to `127.0.0.1:8787`; never hardcode the server URL.
- Validate shapes with the zod schemas in `packages/shared`.

## Screens

Workflow list, graph editor ([DES-010](des-010-graph-editor.md)), run
list and run view ([DES-009](des-009-run-view.md)) are built. Next: run
controls ([DES-011](des-011-run-controls.md)) and workflow lifecycle
([DES-013](des-013-workflow-editing.md)). Each screen gets its own UI
doc before it is built.

## Testing and evidence

- Add `data-testid` to anything e2e tests assert on.
- Every UI change gets a Playwright test in `apps/e2e`. `pnpm test:e2e`
  records video and screenshots into `apps/e2e/test-results`; attach both
  to the PR.
- The layout check, `apps/e2e/tests/layout.spec.ts` (BL-061), visits every
  route in light and dark at 1440x900 and compares screenshot baselines
  in `layout.spec.ts-snapshots/`. After an intended visual change run
  `pnpm --filter e2e exec playwright test layout.spec.ts --update-snapshots`
  and commit the new images.
- UI lint guards live in `apps/web/eslint-ui-guards.js` (dense sizes,
  dialog widths, `font-mono`, frame padding, times) and are tested in
  `apps/web/src/lib/ui-guards.test.ts`.
