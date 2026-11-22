---
id: BL-083
title: LLM node through a CLI
type: backlog
status: todo
summary: LLM node runs a CLI in print mode with tools off and a read-only sandbox; system and prompt files; text out.
tags: [engine, shared, web, nodes, agents]
related: [DES-032, DES-005, DES-006, DES-023]
updated: 2026-11-22
priority: P1
depends: [BL-075, BL-078]
---

# LLM node through a CLI

Design: [DES-032](../designs/des-032-node-catalog.md) (LLM).

## Done when

- [ ] Kind `llm` with `cli`, `model`, `effort`; files `prompt.md` and
      optional `system.md`.
- [ ] The exact print mode and no-tools flags for Claude Code and
      Cursor are checked against the installed CLIs and written into
      DES-032.
- [ ] The step runs in a read-only sandbox that writes only its
      attempt folder; the output is stdout as `text`.
- [ ] It counts against the `agents` limit and joins the trust
      preflight.
- [ ] Unit tests for command building; an opt-in live test per CLI;
      Playwright video and light and dark screenshots.
