---
id: DES-019
title: Agent CLI trust, pre-run check and timeouts
type: design
status: draft
summary: App-owned trust for ~/.flowapp, a warn-only pre-run check, and a per-attempt timeout with mapped failure reasons.
tags: [agents, trust, sandbox, timeout, engine, ui]
related: [DES-003, DES-004, DES-005, DES-006, DES-007, DES-015, BL-017, BL-018]
updated: 2026-11-21
---

# Agent CLI trust, pre-run check and timeouts

Three gaps after shipping agent tasks ([DES-005](des-005-agents-spawn.md)):
the engine has no attempt timeout (DES-015 points at DES-004, which did
not define one), a hung CLI prompt can leave a task `running` until
cancel, and Cursor's workspace trust marker may be denied by the
sandbox ([DES-006](des-006-sandboxing.md)). This design closes those
gaps. The CLIs still run headless: Cursor with
`agent -p --force --trust --workspace <attempt> --add-dir <wf>`,
Claude with `claude --print --permission-mode dontAsk --add-dir <wf>`,
stdin ignored. Claude print mode skips its trust dialog. The app owns
the human trust decision; the CLIs are not asked.

## Timeout

Every attempt, including agent judges, has a timeout. When it fires,
the engine ends the process group (same helper as cancel) and fails
the attempt with reason `timeout`. Retry and repeat apply as for any
failed attempt ([DES-004](des-004-conditions-loops.md)).

`timeout` is a positive integer, in seconds. Resolve in this order:
task `timeout`, then workflow `timeout`, then the builtin default of
`900` (15 minutes). 15 minutes is long enough for a normal agent turn
and short enough that a login or unknown prompt does not sit forever.
Each attempt, and each judge, gets a fresh clock.

The resolved value and the failure `reason` are data on the attempt
(`attempt_finished.reason`, and `timeout` on `attempt_launched` so
resume can enforce the remaining time). The runner does not special
case a CLI here; see Design patterns.

## Failure reasons from stderr

When an attempt ends (exit, interrupt, or timeout), the engine reads
`stderr.log` and, if the task has a CLI, asks that CLI's adapter to
map known patterns to a readable `reason`. Known Cursor patterns:

- `Failed to create trust marker`
- `Failed to trust workspace`
- `Workspace Trust Required`

A mapped trust reason wins over a generic `timeout` or exit code, so
the UI can say the workspace was not trusted rather than only that
the process died. Unknown text stays in the log; the reason then
falls back to `timeout` or the exit.

## App-owned trust

Trust applies to the whole app: all of `FLOWAPP_HOME` (default
`~/.flowapp`). It is not per workflow.

Before starting a run that may launch an agent CLI (a `kind: agent`
task, or an `agent` judge in `when`, `until`, or a branch edge):

- If always-trust is not stored, a dialog asks **Trust once**,
  **Always trust**, or **Cancel**.
- **Trust once** covers that run only, including resume of that run.
  The next new run asks again.
- **Always trust** is stored until revoked. Revoke lives in a small
  app settings place (a row on the home screen is enough).
- **Cancel** does not start the run.

Always-trust is a settings row in `app.db`, not an event. The events
table requires a `run_id` and holds run history; this is current app
preference, bound to the realpath of `FLOWAPP_HOME`. The row stores
`homeRealpath` and `trustedAt`. If the realpath changes (the home
moved, or a symlink now points somewhere else), the stored grant is
invalid and the app asks again. A trust-once grant is recorded on
`run_started` (`trustGrant: once`) so resume does not re-ask mid-run.

A single `decideTrust` function takes the home realpath, the settings
row, and the current run's grant, and returns `once`, `always`, or
`none`. The server uses it to decide whether to show the dialog; the
engine uses it to decide whether to write the marker. They must not
diverge.

## Cursor trust marker

The engine runs outside the sandbox. After a grant, and before the
first agent spawn in that run, it writes Cursor's trust marker for
the `FLOWAPP_HOME` realpath:
`~/.cursor/projects/<sanitized-path>/.workspace-trusted` with
`trustedAt` and `workspacePath`. Cursor inherits trust from parent
directories, except the home directory and paths shallower than three
components. `/Users/dbx/.flowapp` has three components, so it should
qualify; a shallower `FLOWAPP_HOME` (for example a two-component
temp dir in tests) may not. Live verification (BL-018) confirms this.
If inheritance does not apply, also write the marker for the
workflow dir (deeper, still unsandboxed). Do not guess a second
path before that result.

Keep the marker while always-trust is valid, or while any live run
that received a trust grant is still active. When the last such run
ends and always-trust is off, remove it. Count those runs from the
fold, not an in-memory refcount, so a restart cannot drop the count
and remove a marker under a live run. On app start, if always-trust
is valid, ensure the marker exists; if it is not, and no granted run
is live, remove a leftover marker. Revoke always-trust also removes
it, once no granted run is live (or immediately if none are).

Claude's adapter does not write a marker (print mode skips the
dialog). `--trust` and `--force` stay on the Cursor command; `--force`
auto-approves tool actions, which the pre-run dialog must state.

## Pre-run check

The same dialog lists checks, each `pass` or `warn`. **Run** stays
enabled on warnings. The dialog tells the user to double check
before running. When always-trust is valid, the checks still run,
but the dialog appears only if a warning exists; **Run** then
continues, it does not re-ask for trust.

Checks:

- Workflow dir and (for a known run) attempt dir: realpath is inside
  `FLOWAPP_HOME`, no symlink escape, and is not `/` or the user's
  home.
- Sandbox profile write root is exactly the workflow realpath
  (DES-006). A warning if the sandbox will not apply.
- Each needed CLI is installed; show its version.
- The exact flags the adapter will use, including that Cursor
  `--force` auto-approves actions.

A path whose realpath falls outside `FLOWAPP_HOME` is a warning
only, like every other check. That is an accepted risk: the user can
still run, and must double check. Ledger:
[DES-007](des-007-tradeoffs.md).

## Design patterns

Forces, and the smallest pattern that already fits this codebase.
No new framework.

**Per-CLI adapter (strategy).** `buildAgentShellCommand` and
`buildJudgeShellCommand` both branch on `cli`. A third CLI, or
trust, stderr, and version logic, would copy that branch. One
`CliAdapter` record per CLI owns `buildAgentCommand`,
`buildJudgeCommand`, `prepareTrust`, `cleanupTrust`,
`failurePatterns`, and `probeVersion`. `agents.ts` and `judge.ts`
look the adapter up by `cli`. Adding a CLI is one record and one
map entry. Cursor owns the marker; Claude's `prepareTrust` is a
no-op.

**Pre-run checks (list of functions).** More checks will appear.
Each check is a small pure function from input to
`{ id, status: "pass" | "warn", message }`. One function runs the
list. Adding a check is one function and one entry. Checks never
block.

**Trust policy (one decision function).** The server (dialog) and
the engine (marker) must agree. `decideTrust` returns `once`,
`always`, or `none` from the realpath, the settings row, and the
run grant. Both call it. Storage is described above.

**Timeout and failure reasons (data on the attempt).** The runner
should not special case a CLI. It resolves the timeout, kills the
process group, and records `reason`. The adapter only supplies the
stderr mapping. The fold and the UI read the field. Retry sees an
ordinary failed attempt.

**Extension points.** The adapter map, the check list, `timeout` on
workflow and task, the `cli_trust` settings key, and `reason` on the
attempt.

**Deliberately not abstracted.** No plugin loader or CLI discovery
until a third CLI is actually added. No check config file. No
generic capability bus. Judge processes keep their smaller spawn
path (adapter command plus the shared timeout helper) until a real
run shows they need the full sandboxed runner. Revisit when a third
CLI lands, or when a judge hang or sandbox gap shows up in a run.

## Contracts

YAML: optional `timeout` (seconds) on the workflow and on a task.

`app.db`: a `settings` table (`key`, `value`) beside `events`. Key
`cli_trust` holds `{ homeRealpath, trustedAt }`.

Events: `run_started` may include `trustGrant: once`.
`attempt_launched` includes the resolved `timeout`.
`attempt_finished` includes `reason` when known.

HTTP (zod in `packages/shared`):

- `GET /api/trust` returns the policy result and the current
  realpath
- `PUT /api/trust` with `{ grant: "always" | "none" }` to store or
  revoke always-trust
- `POST /api/workflows/:workflowId/runs/preflight` returns
  `{ trust, checks }` for the workflow about to run
- `POST /api/workflows/:workflowId/runs` accepts
  `{ trustGrant?: "once" | "always" }` and returns `409` with
  `trust_required` plus checks when the policy is `none`

## UI

Test ids: `trust-dialog`, `trust-once`, `trust-always`,
`trust-cancel`, `trust-run`, `trust-check-<id>`, `trust-revoke`,
`attempt-reason`.

Playwright evidence is in BL-017 and BL-018: timeout and mapped
reasons; the trust dialog (once, always, cancel, revoke, warning-
only when already trusted); video and screenshots.
