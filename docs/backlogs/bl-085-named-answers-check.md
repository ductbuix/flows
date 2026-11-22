---
id: BL-085
title: Named answers, templates and Judge check mode
type: backlog
status: todo
summary: Agent and LLM nodes declare answers; later nodes use {{name}}; a Judge can test an answer with no model call.
tags: [engine, shared, web, nodes, judge]
related: [DES-032, DES-034]
updated: 2026-11-22
priority: P2
depends: [BL-079, BL-083]
---

# Named answers, templates and Judge check mode

Design: [DES-032](../designs/des-032-node-catalog.md) (Named answers,
Judge).

## Done when

- [ ] `answers` on agent and LLM nodes: up to 20 fields of type text,
      number, yes/no, list or choice.
- [ ] Agents write `out/answer.json`; LLM steps print it; a mismatch is
      asked to fix once, then fails with reason `answer`.
- [ ] `{{name}}` fills prompt, rule, question and Prompt text from the
      nearest upstream answer; an ambiguous name fails validation.
- [ ] Judge check mode tests an answer with the DES-032 operators.
- [ ] The node Sheet edits answers; the step detail shows the answer.
- [ ] Unit tests for parsing, fixing, templates and each operator.
