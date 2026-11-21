---
id: BL-028
title: Run view on AI Elements with Advanced logs
type: backlog
status: done
summary: Terminal, Task, Plan, Stack Trace, File Tree and Confirmation in the run view; env and raw logs behind Advanced.
tags: [ui, web, runs, ai-elements]
related: [DES-024, DES-009, DES-011, DES-019]
updated: 2026-11-21
priority: P1
depends: [BL-027]
---

# Run view on AI Elements with Advanced logs

Design: [DES-024](../designs/des-024-ui-shadcn-baseline.md).
Depends on [BL-027](bl-027-ui-shadcn-foundation.md) for the shell,
the header and the lint guard. Supersedes BL-028 on the unmerged
branch `docs/des-024-ui-foundation`.

## Done when

- [x] `trace` and `code-block` are added with `shadcn add`,
      unedited. Patterns are copied into
      `apps/web/src/components/ai-elements/` with their classes
      as shipped.
- [x] The default log is Terminal. Attempts use Task and Plan. A
      failed attempt uses Stack Trace. `out/` uses File Tree.
      Trust and approve or reject use Confirmation.
      `SUMMARY.md` stays react-markdown; code fences may use
      Code Block.
- [x] An Advanced `Switch` in the page header (`flows-advanced`
      in `localStorage`) shows env as `Item`, `Badge` and
      `Switch`, plus command line, pid, and raw stdout and
      stderr. Off by default.
- [x] Tool, Reasoning and Subagent are not added.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and
      `pnpm test:e2e` pass.
- [x] Playwright covers default and Advanced logs, a failed
      attempt, the output tree, and a confirmation, with video
      and screenshots in light and dark.
