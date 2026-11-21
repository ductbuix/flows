# Connectors

In-repo adapters for outside systems (DES-026). There is no loading from
`FLOWAPP_HOME`: a new source is a pull request (J12).

## Add a connector

1. Create `packages/engine/src/connectors/<id>/` with a module that
   exports a `Connector` (`describe`, `check`, `pull`, `diff`,
   `publish`).
2. Register it in `registry.ts` (or a small init module that calls
   `registerConnector`) so `GET /connectors` and the engine can find it.
3. Cover it with fake-backed or fixture tests; do not hit live services
   in unit tests.

The `fake` connector is for tests only. Register it in the test, not at
app startup. Builtin connectors (`github`, `confluence`, `rally`) are
registered via `registerBuiltinConnectors()` from the server entrypoint.
E2e sets `FLOWAPP_FAKE_CONNECTOR=1` so the server also registers `fake`
for journey coverage (BL-045).

Confluence uses sign-in method `mcp`. Scope holds `space`, `page`, and
either `command` (local stdio MCP) or `url`. The server runs only after
the user allows it (`mcp-trust.json` under FLOWAPP_HOME; Settings lists
and revokes). The adapter calls MCP tools `get_page` and `update_page`
(line-delimited JSON-RPC).
