---
id: BL-022
title: Start run form, run inputs view, and inputs editor
type: backlog
status: done
summary: Start and rerun collect declared inputs, ask on a repeat, show queued runs and the run's files, and edit the inputs list.
tags: [ui, web, runs, editor, inputs]
related: [DES-021, DES-009, DES-010, DES-011, DES-013]
updated: 2026-11-21
priority: P0
depends: [BL-021]
---

# Start run form, run inputs view, and inputs editor

Design: [DES-021](../designs/des-021-run-inputs.md).
Depends on [BL-021](bl-021-run-input-engine.md) because the form,
duplicate ask, and queued state need the schema, start API, and
events.

## Done when

- [x] Start run opens a form built from `inputs:` (or an optional
      file picker when the list is absent). Order is: form, then
      the existing trust dialog if needed, then a Start anyway
      ask when the server returns 409 `duplicate_input`. It never
      auto-skips.
- [x] Rerun opens the same form, prefilled from that run's
      `inputs.json` and remaining files, and starts a new run
      from the current workflow.
- [x] The runs list and run header show `queued`. Cancel is
      allowed on a queued run, with confirm text that it will
      not start. Delete stays blocked while the run is live.
- [x] The run view lists the run's input files and lets the user
      read text and markdown and download files.
- [x] The workflow inspector (no node selected) edits the
      `inputs:` list and `limits.maxConcurrentRuns`. YAML writes
      keep comments and key order.
- [x] Playwright covers the form, a required-field error, the
      duplicate ask, a queued run and its cancel, the run view
      inputs, and the editor list, with video and screenshots.
