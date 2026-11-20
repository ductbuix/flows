---
id: DES-007
title: Trade-offs and open questions
type: design
status: active
summary: Known design risks with when to revisit them, and questions still open.
tags: [tradeoffs, decisions, questions]
related: [DES-001, DES-003, DES-006]
updated: 2026-11-20
---

# Trade-offs and open questions

## Trade-offs

| Decision                         | Risk                            | Revisit when                        |
| -------------------------------- | ------------------------------- | ----------------------------------- |
| Tasks read upstream dirs by path | can read beyond declared needs  | runs must move to another machine   |
| SQLite log, no queue             | single-process engine           | a second machine runs tasks         |
| Sandbox best effort              | unsandboxed on unsupported OSes | first Windows user                  |
| Agent judge conditions           | slow, not deterministic         | judges disagree on identical output |

## Open questions

1. Human approval gates between tasks?
2. OS support on day one: macOS only?
3. Per-task agent budget (tokens, time, cost)?
