---
id: DES-006
title: Sandboxing
type: design
status: active
summary: Baseline process isolation, write-only-in-workflow-dir via OS sandboxes, and the fallback.
tags: [sandbox, security, process]
related: [DES-003, DES-005, DES-007]
updated: 2026-11-20
---

# Sandboxing

- Baseline everywhere: cwd in attempt dir, scrubbed env, own process
  group, timeout.
- File access: write only inside the workflow dir via `sandbox-exec`
  (macOS) or `bubblewrap` (Linux).
- Agent CLIs: use their own permission and allowed-dir flags.
- Fallback: run unrestricted with a warning badge.
