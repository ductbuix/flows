---
id: BL-038
title: Work item store and API
type: backlog
status: todo
summary: workitems/<id>/ with workitem.yaml, notes.md and attachments, a shared schema, and server CRUD routes. Ad hoc only.
tags: [server, engine, work-items, api]
related: [DES-026, DES-021]
updated: 2026-11-22
priority: P1
depends: []
---

# Work item store and API

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Work items, Folder layout). Ad hoc work items
only; a source link (Rally story, Confluence page) needs connections
and comes with BL-046. Runs do not reference work items yet (BL-039).

## Done when

- [ ] Shared zod `workItemSchema`: id, title, `source` (`{ kind:
  adhoc }` for now), optional `workflowId`, `inputs` (name to
      value), `links` (empty list until BL-046), createdAt, updatedAt.
      Unknown keys are errors.
- [ ] Files live at `FLOWAPP_HOME/workitems/<id>/workitem.yaml`,
      `notes.md` and `attachments/`. Ids are generated slugs; writes
      are atomic (temp file then rename).
- [ ] Routes: `GET /workitems`, `POST /workitems`, `GET/PUT
  /workitems/:id` (hash, 409 on mismatch like workflows), `GET/PUT
  /workitems/:id/notes`, attachment list, upload and delete,
      `DELETE /workitems/:id`.
- [ ] Delete moves the folder to `workitems/.trash/` and never deletes
      runs.
- [ ] Server tests cover create, update with stale hash, notes,
      attachments, path traversal on attachment names, and delete.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
