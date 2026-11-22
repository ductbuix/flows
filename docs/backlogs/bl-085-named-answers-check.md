---
id: BL-085
title: Named answers and templates
type: backlog
status: todo
summary: answers on Agent and LLM nodes, parsed and fixed once; {{name}} filled from the nearest upstream answer.
tags: [shared, engine, web, answers]
related: [DES-032]
updated: 2026-11-22
priority: P2
depends: [BL-083]
---

# Named answers and templates

Design: [DES-032](../designs/des-032-node-catalog.md) (Named answers and templates).

## Done when

- [ ] `answers` on agent and LLM nodes: up to 20 fields of type text, number, yes/no, list or choice.
- [ ] Agents write `out/answer.json`; LLM steps print it; a mismatch is asked to fix once, then fails with reason `answer`.
- [ ] `{{name}}` fills prompt, rule, question and Prompt text; an ambiguous name fails validation.
- [ ] The node Sheet edits answers; the step detail shows the answer.
- [ ] Test: `packages/shared/src/nodes/answers.test.ts` (parse, templates, ambiguity) and `packages/engine/src/nodes/answers.test.ts` (fix once, then fail). Playwright video plus light and dark screenshots of the changed screens; BL-061 layout baselines refreshed in the same change.
