---
id: BL-064
title: "One Start run dialog and plain trust copy"
type: backlog
status: todo
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

- [ ] "Start run" in the header of the work item page and every workflow
      tab opens the same 448px dialog; the Overview Start card, the Work
      item Start card and `StartRunForm` are removed.
- [ ] From a work item it asks for the workflow; from a workflow it asks
      for the work item or "None, ad hoc", both as `Combobox`; declared
      inputs sit in a `ScrollArea` with `max-h-96`.
- [ ] Files use `Attachment` chips and an "Add files" button; no native
      file input remains.
- [ ] Start shows a `Spinner` during the pre-run check.
- [ ] The trust dialog is titled "Allow Cursor to run on this Mac?" (per
      CLI), with footer Cancel, Always allow (`outline`), Allow and
      start (primary); checks, FLOWAPP_HOME, paths and flags sit in a
      closed `Collapsible` "Technical checks". The MCP trust dialog
      matches.
- [ ] Evidence: light and dark screenshots at
      1440x900 of starting from a work item, a workflow and the Runs
      tab, and the first agent run, attached to the PR.
