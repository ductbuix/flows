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
app startup. Builtin connectors (today: `github`) are registered via
`registerBuiltinConnectors()` from the server entrypoint.
