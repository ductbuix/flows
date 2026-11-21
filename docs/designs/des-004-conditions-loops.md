---
id: DES-004
title: Conditions and loops
type: design
status: active
summary: Condition kinds (exit, expr, agent) shared by when, until and branches; retry and repeat policies.
tags: [engine, conditions, loops, retry]
related: [DES-002, DES-003, DES-019]
updated: 2026-11-21
---

# Conditions and loops

## Conditions

| Kind  | Checks                                        | Cost  |
| ----- | --------------------------------------------- | ----- |
| exit  | exit code equals or is in a set               | free  |
| expr  | safe expression over output files             | cheap |
| agent | agent CLI judges output, returns pass or fail | slow  |

Combine with `all` / `any`; cheap kinds evaluate first. The same shape
serves `when`, `until`, and branch edges. `agent` is BL-011.

```yaml
when: false # always skip
when: { exit: 0 } # every need's latest exit matches
when: { exit: [0, 1] }
when: { expr: "json('out/score.json').score >= 0.8" }
when: { agent: { cli: claude, instructions: tasks/judge.md } }
when: { all: [{ exit: 0 }, { expr: "text('out/ok.txt') == 'yes'" }] }
when: { any: [{ exit: 0 }, { exit: 2 }] }
```

`expr` may use `json('rel')` and `text('rel')` (paths under the attempt
root), property access, literals, `== != < > <= >=`, `&& || !`, and
parentheses. No function calls beyond `json` / `text`.

### Agent judge

`agent` runs a headless Claude Code or Cursor CLI (same adapters as
DES-005) with cwd at the subject attempt root. The CLI reads
`instructions` (workflow-relative) and must exit `0` for pass or
non-zero for fail. Judges are not graph tasks and do not take an
`agents` slot. Results are cached per (cli, instructions, attempt root)
for the run so ticks do not re-spawn. In `all` / `any`, `exit` and
`expr` (and nested groups that contain only those) run before any
`agent` leaf.

## Where conditions run

| Site        | Context                                             |
| ----------- | --------------------------------------------------- |
| `when`      | Before first launch; `exit` uses each need's latest |
| `until`     | After a successful attempt; context is that attempt |
| Branch edge | Need is an object with `when`; context is that task |

## Needs and branch edges

`needs` entries are a task id string or an object:

```yaml
needs:
  - plan
  - task: check
    when: { exit: 0 } # branch edge
  - task: optional
    allowSkipped: true
```

- Plain id: ready when that task `succeeded`. If it is `skipped`, this
  task is skipped (skip propagation) unless `allowSkipped: true`.
- Branch edge: wait until the upstream is terminal (`succeeded`,
  `failed`, or `skipped`). Then evaluate `when` against that task's
  latest attempt. True → ready (even if the upstream failed). False →
  skip. Upstream `skipped` without `allowSkipped` → skip.
- A failed plain need blocks the dependant; the run fails unless the
  failed task has `continueOnError: true`.

## Loops

- `retry`: on non-zero exit or interrupt. Default `max: 3`. Backoff
  starts at 2s and doubles after each failed attempt. Opt-in via
  `retry:` (empty object uses defaults).
- `repeat`: after success, keep launching until `until` passes. Default
  `max: 5`. Opt-in via `repeat: { until: ... }`.
- Counters are separate. Every launch gets its own `attempt-<n>/`.
- Approval gates ask only before the first launch (DES-003).

```yaml
retry: { max: 2 }
repeat: { max: 5, until: { expr: "json('out/score.json').score >= 0.8" } }
```

## Timeout

Every attempt, including agent judges, has a timeout
([DES-019](des-019-agent-trust-and-timeouts.md)). When it fires, the
engine ends the process group and fails the attempt with reason
`timeout`. Retry applies as for any failed attempt.

`timeout` is a positive integer, in seconds. Resolve in this order:
the task value, the workflow value, then the builtin default of
`900` (15 minutes). Each attempt gets a fresh clock.

```yaml
timeout: 900
tasks:
  - id: plan
    kind: agent
    timeout: 1800
```

## Events and fold

`attempt_finished` / `attempt_interrupted` record the attempt. If the
task has `retry` or `repeat`, the fold leaves status `running` and the
scheduler decides the next step (backoff launch, or a terminal event).
Without those policies, exit `0` succeeds and anything else fails, as
before.

New terminal events: `task_succeeded`, `task_failed`, `task_skipped`.
`skipped` is terminal and does not fail the run.
