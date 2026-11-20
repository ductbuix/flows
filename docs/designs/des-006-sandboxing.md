---
id: DES-006
title: Sandboxing
type: design
status: active
summary: macOS only on day one; baseline isolation, writes limited to the workflow dir via sandbox-exec, warned fallback.
tags: [sandbox, security, process]
related: [DES-003, DES-005, DES-007]
updated: 2026-11-21
---

# Sandboxing

Day one supports macOS only. Linux (`bubblewrap`) and Windows are out of
scope for now (DES-007 ledger).

- Baseline everywhere: own process group; `TMPDIR` under the attempt dir
  so temp writes stay inside the workflow; timeout (DES-004).
- File access: write only inside the workflow dir via `sandbox-exec`
  (macOS). Profile uses `-D WF_DIR=<realpath>` and denies other
  `file-write*`.
- Agent CLIs: Claude `--add-dir <workflow>`; Cursor
  `--workspace <attempt> --add-dir <workflow>`, on top of the OS sandbox.
- Fallback: when `sandbox-exec` cannot be applied (non-macOS, missing
  binary, or `FLOWAPP_SANDBOX=0`), the task runs unrestricted.
  `attempt_launched.sandboxed` records the choice; the run stays
  `sandboxed` only while every launch was sandboxed. The run header shows
  a warning badge when `sandboxed` is false (DES-009).
- Events: `attempt_launched` carries optional `sandboxed`. Older events
  without the field count as unrestricted.
