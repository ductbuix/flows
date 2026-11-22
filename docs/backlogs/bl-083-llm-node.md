---
id: BL-083
title: LLM node through a CLI
type: backlog
status: done
summary: "LLM kind: one CLI call in print mode with tools off, read-only sandbox, stdout as text."
tags: [engine, web, nodes, llm]
related: [DES-032]
updated: 2026-11-22
priority: P1
depends: [BL-096]
---

# LLM node through a CLI

Design: [DES-032](../designs/des-032-node-catalog.md) (LLM). One kind: three registry files.

## Done when

- [x] The exact print mode and no-tools flags for Claude Code and Cursor are checked against the installed CLIs and written into DES-032 first.
- [x] Kind `llm` with `cli`, `model`, `effort`; files `prompt.md` and optional `system.md`.
- [x] The step runs in a read-only sandbox that writes only its attempt folder; stdout is `text`; it counts against `agents` and joins the trust preflight.
- [x] Test: `packages/engine/src/nodes/llm.test.ts` for command building with a stub CLI; an opt-in live test per CLI. Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
