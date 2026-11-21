---
id: BL-042
title: Connection model, connector registry and uses
type: backlog
status: todo
summary: "connection.yaml schema, the connector interface and registry, connections CRUD and check routes, and task uses: parsed and validated."
tags: [engine, server, connections, schema]
related: [DES-026, DES-019]
updated: 2026-11-22
priority: P1
depends: []
---

# Connection model, connector registry and uses

Design: [DES-026](../designs/des-026-work-items-library-connections.md) (Concepts, Folder layout, Extending). No real
connector yet: tests register a `fake` connector. Nothing is pulled.

## Done when

- [ ] `packages/shared/src/connection.ts`: zod for `connection.yaml`
      (id, connector, name, scope, sign-in method `cli`, `mcp` or
      `cookies`, refresh rule `15m`, `1h`, `1d` or `never`, policy
      `read-only` (default) or `approve-each-publish`) and task
      `uses: [{ connection, access: read | propose }]`.
- [ ] Connection ids are slugs (`[a-z0-9-]`); an id whose env name
      (`RESOURCE_` plus upper snake case) equals another's is 409.
- [ ] `packages/engine/src/connectors/` holds the interface
      (`describe`, `check`, `pull`, `diff`, `publish`) and a registry
      keyed by connector id, the same pattern as `CliAdapter`.
      Connectors are in-repo modules only; there is no loading from
      `FLOWAPP_HOME`. `connectors/README.md` lists the steps to add
      one (J12): folder, interface, registry line, fake-backed tests.
- [ ] Routes: `GET /connectors` (describe of each),
      `GET/POST /connections`, `GET/PUT/DELETE /connections/:id`,
      `POST /connections/:id/check`. Delete is 409 while a workflow
      uses the connection, and removes `secrets/<connectionId>/`.
- [ ] Workflow parse accepts `uses`. Preflight warns on an unknown
      connection, on `propose` (not built yet), and on an ambient
      login the connector reports.
- [ ] No secret field is accepted in `connection.yaml`; a test asserts
      the schema rejects `token`, `password` and `cookie` keys.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
