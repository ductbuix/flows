---
id: BL-064
title: "One Start run dialog and plain trust copy"
type: backlog
status: done
summary: One 448px Start dialog from every start point, Attachment files, preflight Spinner, and an Allow agent CLI dialog in plain words.
tags: [ui, web, runs, ux]
related: [DES-029, DES-019, DES-021]
updated: 2026-11-22
priority: P1
depends: [BL-058, BL-060]
---

# One Start run dialog and plain trust copy

Design: [DES-029](../designs/des-029-ui-renovation-run-screens.md)
(Dialogs: Start run, Allow agent CLI). Fixes S14, S15, S16, #23, #24.

## Done when

- [x] "Start run" in the header of the work item page and every workflow
      tab opens the same 448px dialog; the Overview Start card, the Work
      item Start card and `StartRunForm` are removed.
- [x] From a work item it asks for the workflow; from a workflow it asks
      for the work item or "None, ad hoc", both as `Combobox`; declared
      inputs sit in a `ScrollArea` with `max-h-96`.
- [x] Files use `Attachment` chips and an "Add files" button; no native
      file input remains.
- [x] Start shows a `Spinner` during the pre-run check.
- [x] The trust dialog is titled "Allow Cursor to run on this Mac?" (per
      CLI), with footer Cancel, Always allow (`outline`), Allow and
      start (primary); checks, FLOWAPP_HOME, paths and flags sit in a
      closed `Collapsible` "Technical checks". The MCP trust dialog
      matches.

## Notes

- `StartRunDialog` replaces `StartRunForm`; `TrustStartGate` keeps the
  dialog open (button `Spinner`) while preflight runs.
- Start entry points: `run-start` in every workflow tab header
  (`WorkflowStartButton`) and `work-item-start` on the work item page.
- Preflight returns `clis` so the trust title can name Cursor or Claude
  Code. `TechnicalChecks` is the shared closed `Collapsible`.
