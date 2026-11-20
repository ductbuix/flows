---
id: DES-007
title: Trade-offs and open questions
type: design
status: active
summary: Ledger of known risks (decision, risk, guard, revisit trigger) for the design and tooling, plus open questions.
tags: [tradeoffs, decisions, questions, tooling]
related: [DES-001, DES-003, DES-006, DOC-001]
updated: 2026-11-20
---

# Trade-offs and open questions

Each entry is a deliberate choice. The guard is what limits the damage
today; the revisit trigger is the concrete event that reopens it. Add an
entry whenever you ship something knowingly imperfect, and delete it when
the trigger fires and the choice changes.

## Engine design

| Decision                         | Risk                            | Guard                                                 | Revisit when                        |
| -------------------------------- | ------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| Tasks read upstream dirs by path | can read beyond declared needs  | writes limited to the workflow dir (DES-006)          | runs must move to another machine   |
| SQLite log, no queue             | single-process engine           | append-then-act and replay on resume (DES-003)        | a second machine runs tasks         |
| Sandbox best effort              | unsandboxed on unsupported OSes | warning badge on unsandboxed runs (DES-006)           | first Windows user                  |
| Agent judge conditions           | slow, not deterministic         | cheap kinds evaluate first; loop max counts (DES-004) | judges disagree on identical output |

## Tooling and docs

### Docs indexes are unpadded and skip prettier

- Risk: raw tables are harder for humans to read; a hand edit could break
  them.
- Guard: only the generator writes them. `docs:check` fails on stale
  indexes and on tables without a header, separator row or equal cell
  counts. The Cursor hook regenerates them after doc edits.
- Revisit when: a renderer shows a broken index table, or people read the
  raw indexes more than agents do.

### Server runs from source with `tsx`, no build step

- Risk: slower start, `tsx` is a runtime dependency, no bundled artifact.
- Guard: `pnpm typecheck` covers the server; it binds to `127.0.0.1` only.
- Revisit when: the app is packaged or distributed, or cold start passes
  2 seconds.

### Playwright reuses a running dev server outside CI

- Risk: e2e may test a stale or hand-started server.
- Guard: `CI=1` forces fresh servers; the e2e test only reads health today.
- Revisit when: an e2e result differs between a fresh run and a reused
  server.

### Playwright records video and screenshots for every test

- Risk: slower runs and more disk in `apps/e2e/test-results`.
- Guard: `PW_VIDEO` and `PW_SCREENSHOT` lower it; results are git-ignored.
- Revisit when: the e2e suite takes over 2 minutes or results pass 500 MB.

### Cursor format hook fails open

- Risk: an error `eslint --fix` cannot fix slips past the hook.
- Guard: `pnpm lint` is part of "done" in `AGENTS.md` and the rules.
- Revisit when: a lint error reaches a commit on `develop`.

### One ESLint config per package

- Risk: six `eslint.config.js` files (two React, four Node copies) drift.
- Guard: each uses the same recommended sets; `pnpm lint` runs them all.
- Revisit when: one rule change has to be made in more than one file.

Index size, measured on 2026-11-20 with 20 docs (generated vs the same
file run through prettier): root 655 vs 1053 bytes, designs 1915 vs 2597,
backlogs 2466 vs 3299. Prettier adds 33 to 60 percent, all padding, and
the overhead grows with the longest summary in each table.

## Open questions

1. Human approval gates between tasks?
2. OS support on day one: macOS only?
3. Per-task agent budget (tokens, time, cost)?

UI questions live in the UI design docs (DES-009, DES-010).
