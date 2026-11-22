---
id: BL-073
title: "Workflow display name: optional name in workflow.yaml"
type: backlog
status: todo
summary: Optional top-level name in workflow.yaml, returned by the API, editable in the editor, kept on YAML round-trip; id is the fallback.
tags: [ui, web, server, shared, yaml]
related: [DES-002, DES-027, DES-028, DES-029, DES-030, DES-013]
updated: 2026-11-22
priority: P0
depends: []
---

# Workflow display name: optional name in workflow.yaml

Design: [DES-002](../designs/des-002-workflow-files.md) (Workflow file),
[DES-027](../designs/des-027-ui-renovation.md) (Resolved questions).
pootato decided on 2026-11-22 that a workflow can carry a display name.
The folder id stays the stable key; the name is only a label. Without a
name, the UI shows the humanized id ("feature-spec" becomes "Feature
spec").

## Done when

- [ ] `packages/shared` `workflowSchema` has
      `name: z.string().trim().min(1).max(80).optional()`; a workflow
      without `name` still parses; tests cover with, without, empty and
      too long.
- [ ] `setWorkflowField` accepts `"name"`; setting and clearing it keeps
      comments and key order, and a new `name` is written right after
      `id`; YAML edit tests cover both.
- [ ] `workflowSummarySchema` has optional `name`; `GET /workflows`
      returns it from `workflows-fs.ts`; the workflow GET already returns
      the parsed file, so the editor reads it there. Server tests cover
      both.
- [ ] `createWorkflowBodySchema` takes an optional `name`; the starter
      `workflow.yaml` writes it when given. Rename (folder id) keeps the
      `name` unchanged.
- [ ] The web app has one `workflowLabel(summary)` that returns `name`,
      else the humanized id, with unit tests (BL-059 uses it everywhere).
- [ ] The editor can edit the name: a `Field` "Name" (`Input`, 32px) at
      the top of today's workflow panel, saved with the workflow; BL-067
      moves it into the workflow settings Sheet.
- [ ] Create workflow asks for Name first and fills the folder id from
      it (lowercase, dashes), still editable, shown in mono.
- [ ] DES-002 shows `name` in the workflow file example.
- [ ] Evidence: Playwright video plus light and dark screenshots at
      1440x900 of creating a named workflow, editing its name in the
      editor, and the sidebar and Workflows table showing it, attached to
      the PR.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`
      pass.
