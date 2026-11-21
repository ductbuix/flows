---
id: DES-021
title: Run inputs and reuse
type: design
status: active
summary: Each run has a frozen input folder and optional declared inputs; extra runs queue under a workflow limit.
tags: [engine, runs, inputs, yaml, ui]
related:
  [
    DES-002,
    DES-003,
    DES-007,
    DES-009,
    DES-010,
    DES-011,
    DES-013,
    DES-014,
    DES-019,
    BL-021,
    BL-022,
  ]
updated: 2026-11-21
---

# Run inputs and reuse

A workflow should run many times with different inputs, for example
one Jira ticket per run. Sources must not be tied to Jira.
Connectors are out of scope for this cut.

Today every run reads the same workflow `input/` folder, and Start
run sends no values. This design gives each run its own frozen
input, an optional declared form, a Manual source, a repeat check,
and a queued state when the workflow is already at its run cap.

## Per-run input

Each run has `runs/<runId>/input/`, exposed to tasks as `RUN_INPUT`.
`WF_INPUT` still points at the workflow's `input/` and stays the
shared defaults.

At start, the engine creates the run input dir, copies the
workflow `input/` into it, then writes the run's values on top
(a declared field wins on a name clash). It then writes
`inputs.json`. After `run_started`, that folder is immutable:
retry, resume, and later attempts only read it.

Layout after start:

```
runs/<runId>/input/
  inputs.json
  <name>.txt          # type text
  <name>.md           # type markdown
  <name>/<basename>   # type file
  attach/<basename>   # undeclared attachments (no inputs: list)
  ...copied defaults
```

`inputs.json` holds `source` (`manual` for this cut), `itemKey`,
`itemKeyVersion`, and each field's type plus its string value or
relative path. `run_started` stores `source`, `itemKey`,
`inputHash`, and the relative file list, not file bodies. The fold
keeps those fields on run state so the run view and resume agree.

## Declared inputs

`workflow.yaml` may have an optional `inputs:` list:

```yaml
inputs:
  - name: ticket
    type: text
    required: true
    description: Ticket key
  - name: brief
    type: markdown
    required: false
  - name: attachment
    type: file
    required: false
```

Allowed types are `text`, `markdown`, and `file`. That is enough
for a ticket key, a brief, and an upload. A folder path, JSON
object, number, or boolean is left out until a source needs it
(ledger). `default` is allowed only on `text` and `markdown`.
Empty required fields are invalid. A missing optional field with
a default is written as that default.

`name` is unique in the list, matches
`^[A-Za-z][A-Za-z0-9_-]*$`, and cannot be `inputs` or `attach`
(reserved for `inputs.json` and undeclared files).

The server builds a zod schema from the list and validates the
Start run body. Invalid input returns 400 with
`{ error: "invalid_input", fields: { <name>: <message> } }`.

When the workflow has no `inputs:` list, Start run still copies
`WF_INPUT` and may attach extra files under `attach/`. There are
no required fields.

## Start run

The Start run control opens a form built from `inputs:` (or a
file picker only, when the list is absent). Order:

1. The user fills the form and optional attachments.
2. The existing trust dialog runs if the workflow needs an agent
   CLI (DES-019). Trust is granted before the run is created,
   including when it will be queued.
3. The server starts the run, or returns 409
   `{ error: "duplicate_input", itemKey, existingRunIds }` when a
   non-deleted run of this workflow already has the same item key
   and the body did not set `confirmDuplicate: true`. The UI asks
   whether to start anyway, then retries with that flag. It never
   auto-skips.

The JSON body is `requestId`, optional `trustGrant`, optional
`values` (map of field name to string), and optional
`confirmDuplicate`. When a `file` field or an undeclared
attachment is present, the request is `multipart/form-data` with
a `body` JSON part and file parts named after the field (or
`attach` for undeclared files). A JSON-only body is enough when
there are no files.

The response is `{ runId, status }`, where `status` is `queued`
or `running`.

Rerun opens the same form, prefilled from that run's
`inputs.json` and remaining files. It creates a new run from the
current workflow, as today, and can hit the duplicate check.

## Sources

A source is a small strategy record, the same pattern as the CLI
adapters in DES-019:

- `id`: a stable string (`manual` for this cut)
- `materialize(item, destDir)`: writes one item into the run
  input dir (after the `WF_INPUT` copy)

This cut ships only Manual: one item from the Start run form.
`listItems` is not on the interface until a second source needs
it.

Later sources (a folder of `.md` files, a JSON Lines or CSV
list, then connectors) are more adapters. They list items, call
the same materialize-and-start path, and need no engine change.
Their UI is not designed here.

## Item key

The Manual item key is the hex SHA-256 of a canonical JSON
object `{ v: 1, source: "manual", fields: [...] }`, with fields
sorted by name. Each field is `{ name, type, text }` or
`{ name, type, sha256 }` for a file. `text` values are NFC
normalized; leading and trailing whitespace is trimmed only for
`type: text`. Optional omitted fields are left out. Copied
`WF_INPUT` defaults are not part of the key: the same form
values are the same item, even if shared defaults changed.

`itemKeyVersion` in `inputs.json` is `1`. Changing the algorithm
bumps the version; old runs keep the key they were started with.

Deleted runs do not count in the duplicate check.

## Queued runs

`limits.maxConcurrentRuns` caps how many runs of one workflow
may be `running` at once. When the key is omitted, the default
is 1, not unlimited. There is no global cap in `config.yaml`
(ledger).

If a start would go over the cap, the run is still created and
its input is frozen, but its status is `queued`. The scheduler
is not attached. When a run of that workflow leaves `running`
(`succeeded`, `failed`, or `cancelled`), the engine activates
the oldest queued run (by `run_started.at`), appends
`run_activated`, and attaches the scheduler. The cap is read
from the current `workflow.yaml`, not from a frozen graph.

New run status: `queued`, then `running`, then `succeeded`,
`failed`, or `cancelled`. `run_started` may leave the run
`queued`. `run_activated` is the only new event. Resume
replays as today; queued runs have no process to re-attach.
After replay, free slots activate queued runs in the same FIFO
order.

Cancel is allowed on `queued` and does not need a scheduler: it
appends `cancel_requested` and `run_cancelled`. A queued run
counts as live: delete is blocked until it is cancelled, and
workflow rename or delete is blocked while any run is `queued`
or `running`. `hasLiveRun` is true in both cases.

A trust-once grant is stored on `run_started` and is not asked
again on activate. Queued trust-once runs count as live grants
for the trust marker (DES-019). The marker is written at start
when granted, and again on activate if it is missing.

## Design patterns

Reuse existing patterns; add no new layers until a third source
exists.

- Source adapter (strategy): input materialize stays on the
  source adapter, the same way command building stays on the
  CLI adapter.
- Event log: queue, activate, and cancel are events; state
  stays a fold.
- File-based I/O: run data is files, plus a small `inputs.json`.
- Validation is a zod schema built from the declaration, on the
  server, not a new form framework.
- Start preflight and `decideTrust` stay as they are.

## Impact map

| Area | What changes |
| ---- | ------------ |
| Shared | `inputs` and `maxConcurrentRuns` on the workflow schema; `queued` and `run_activated`; `run_started` payload; start body, 400 and 409 errors, start response `status` |
| Engine | copy and write `runs/<runId>/input/`; `RUN_INPUT`; Manual adapter; start may queue; fold; cancel without a scheduler; `hasLiveRun`; resume activates; trust marker for queued |
| Server | validate values and files; `confirmDuplicate`; multipart start |
| Web | Start run form, then trust, then the duplicate ask; rerun prefills; list and header show `queued`; run view lists the run's inputs; editor Inputs list and the new limit |
| Tests | fixtures; two starts on one workflow now queue unless the limit is raised; API and Playwright (videos and screenshots on the UI item) |
| Docs | DES-002, 003, 007, 009, 010, 011, 013, 014, 016, 017 |

Existing start clients that send only `requestId` and
`trustGrant` stay valid. A workflow with no `inputs:` and a
single run at a time behaves as today, plus an empty run
input dir that holds a copy of `WF_INPUT`.

## Out of scope

Connectors, and the UI for folder or list sources. Declared
task outputs stay a later design.
