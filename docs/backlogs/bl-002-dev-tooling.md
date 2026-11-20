---
id: BL-002
title: Dev tooling and agent setup
type: backlog
status: done
summary: Cursor format hook, eslint and prettier everywhere, Vitest, Playwright e2e, AGENTS.md and Cursor rules.
tags: [tooling, testing, agents]
related: [DES-008]
updated: 2026-11-20
priority: P0
depends: [BL-001]
---

# Dev tooling and agent setup

Done in commits `eeb33e8`, `a9428ae`, `545754a`.

## Scope

- `.cursor/hooks.json`: prettier and `eslint --fix` after each agent edit.
- `pnpm lint`, `lint:fix`, `format`, `format:check`, `test`, `test:e2e`.
- `apps/e2e` Playwright package with video and screenshots on.
- `AGENTS.md` (under 100 lines) and `.cursor/rules/*.mdc`.

## Done when

- [x] Hook fixes a badly formatted file when fed a sample payload.
- [x] lint, typecheck, test, test:e2e and format:check pass.
