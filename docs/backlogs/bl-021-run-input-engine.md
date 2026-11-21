---
id: BL-021
title: Run inputs, item keys, and queued runs
type: backlog
status: todo
summary: Frozen per-run input, declared inputs schema, Manual start API, duplicate check, and queued status under maxConcurrentRuns.
tags: [engine, server, runs, inputs]
related: [DES-021, DES-002, DES-003, DES-011, DES-019]
updated: 2026-11-21
priority: P0
depends: []
---

# Run inputs, item keys, and queued runs

Design: [DES-021](../designs/des-021-run-inputs.md).

## Done when

- [ ] `workflowSchema` accepts an optional `inputs:` list (`name`,
      `type` of `text`, `markdown`, or `file`, `required`, optional
      `description` and `default`) and `limits.maxConcurrentRuns`
      (omitted means 1). Reserved and unsafe names are a parse error.
- [ ] `startRun` copies workflow `input/` into `runs/<runId>/input/`,
      materializes form values and files, and writes `inputs.json`.
      After `run_started` the folder is immutable. Tasks get
      `RUN_INPUT`. Existing start bodies without values still work.
- [ ] A Manual source adapter writes one item. The server builds zod
      from the declaration and returns 400 `invalid_input` with
      per-field errors, or 409 `duplicate_input` with `itemKey` and
      `existingRunIds` unless `confirmDuplicate` is true. Deleted
      runs do not count. Multipart is used when files are present.
- [ ] `run_started` records `source`, `itemKey`, `inputHash`, and
      the file list. When the workflow is already at its running
      cap, the run is `queued` and no scheduler is attached.
      `run_activated` moves it to `running` FIFO when a slot frees.
      Resume does the same after replay.
- [ ] Cancel of a queued run does not need a scheduler.
      `hasLiveRun` is true for `queued` and `running`; delete,
      rename, and workflow delete stay blocked until the run is
      no longer live. A trust-once grant is stored on
      `run_started` and is not re-asked on activate; queued
      trust-once runs count as live grants for the marker.
- [ ] The start response includes `status` (`queued` or `running`).
      Tests cover materialize, validation, the item key, duplicate
      409, default cap 1, queue and activate, cancel, delete, and
      resume.
