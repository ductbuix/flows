import { zValidator } from "@hono/zod-validator"
import {
  createConnection,
  deleteConnection,
  getConnector,
  listConnections,
  listConnectors,
  listLibrary,
  readConnection,
  updateConnection,
  workflowsUsingConnection,
  type Engine,
} from "@workspace/engine"
import {
  connectionCheckResultSchema,
  connectionDetailSchema,
  connectionListItemSchema,
  connectionParamSchema,
  connectionSchema,
  connectionsListSchema,
  connectorsListSchema,
  type Connection,
  type ConnectionCheckResult,
  type ConnectionDetail,
  type ConnectionsList,
  type ConnectorsList,
} from "@workspace/shared"
import { Hono } from "hono"

function storeErrorStatus(kind: string): 400 | 404 | 409 {
  if (kind === "not_found") return 404
  if (kind === "exists" || kind === "env_conflict" || kind === "in_use") {
    return 409
  }
  return 400
}

function runsUsingConnection(home: string, connectionId: string): string[] {
  const ids = new Set<string>()
  for (const entity of listLibrary(home).entities) {
    if (entity.connection !== connectionId) continue
    for (const rev of entity.revisions) {
      for (const runId of rev.pinningRunIds) ids.add(runId)
    }
  }
  return [...ids].sort()
}

/** GET /connectors, connections CRUD and check (DES-026 / BL-042). */
export function connectionRoutes(engine: Engine) {
  return new Hono()
    .get("/connectors", (c) => {
      const body: ConnectorsList = {
        connectors: listConnectors().map((conn) => conn.describe()),
      }
      return c.json(connectorsListSchema.parse(body), 200)
    })
    .get("/connections", (c) => {
      const body: ConnectionsList = {
        connections: listConnections(engine.home).map((conn) =>
          connectionListItemSchema.parse({
            ...conn,
            usedBy: workflowsUsingConnection(engine.home, conn.id),
          })
        ),
      }
      return c.json(connectionsListSchema.parse(body), 200)
    })
    .post("/connections", zValidator("json", connectionSchema), (c) => {
      const body = c.req.valid("json")
      const result = createConnection(engine.home, body)
      if (!result.ok) {
        return c.json(
          { message: result.error.kind, ...result.error },
          storeErrorStatus(result.error.kind)
        )
      }
      return c.json(
        connectionSchema.parse(result.value) satisfies Connection,
        201
      )
    })
    .get(
      "/connections/:id",
      zValidator("param", connectionParamSchema),
      (c) => {
        const { id } = c.req.valid("param")
        const conn = readConnection(engine.home, id)
        if (!conn) return c.json({ message: "not_found" }, 404)
        const detail: ConnectionDetail = connectionDetailSchema.parse({
          ...conn,
          usedByWorkflows: workflowsUsingConnection(engine.home, id),
          usedByRuns: runsUsingConnection(engine.home, id),
        })
        return c.json(detail, 200)
      }
    )
    .put(
      "/connections/:id",
      zValidator("param", connectionParamSchema),
      zValidator("json", connectionSchema),
      (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const result = updateConnection(engine.home, id, body)
        if (!result.ok) {
          return c.json(
            { message: result.error.kind, ...result.error },
            storeErrorStatus(result.error.kind)
          )
        }
        return c.json(
          connectionSchema.parse(result.value) satisfies Connection,
          200
        )
      }
    )
    .delete(
      "/connections/:id",
      zValidator("param", connectionParamSchema),
      (c) => {
        const { id } = c.req.valid("param")
        const result = deleteConnection(engine.home, id)
        if (!result.ok) {
          return c.json(
            { message: result.error.kind, ...result.error },
            storeErrorStatus(result.error.kind)
          )
        }
        return c.body(null, 204)
      }
    )
    .post(
      "/connections/:id/check",
      zValidator("param", connectionParamSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const conn = readConnection(engine.home, id)
        if (!conn) return c.json({ message: "not_found" }, 404)
        const connector = getConnector(conn.connector)
        if (!connector) {
          return c.json(
            { message: "unknown_connector", connector: conn.connector },
            400
          )
        }
        const result = await connector.check(conn, engine.home)
        return c.json(
          connectionCheckResultSchema.parse(
            result
          ) satisfies ConnectionCheckResult,
          200
        )
      }
    )
}
