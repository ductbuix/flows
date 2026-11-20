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

- Baseline everywhere: cwd in attempt dir, scrubbed env, own process
  group, timeout.
- File access: write only inside the workflow dir via `sandbox-exec`
  (macOS).
- Agent CLIs: use their own permission and allowed-dir flags.
- Fallback: when the sandbox cannot be applied, run unrestricted with a
  warning badge.
