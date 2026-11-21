import { zValidator } from "@hono/zod-validator"
import {
  allowMcpServerAlways,
  allowMcpServerOnce,
  listAllowedMcpServers,
  revokeMcpServer,
  type Engine,
} from "@workspace/engine"
import {
  mcpTrustStatusSchema,
  putMcpTrustBodySchema,
  type McpTrustStatus,
} from "@workspace/shared"
import { Hono } from "hono"

/** GET/PUT /mcp-trust — allowlist for local MCP servers (DES-026 / BL-054). */
export function mcpTrustRoutes(engine: Engine) {
  return new Hono()
    .get("/mcp-trust", (c) => {
      const body: McpTrustStatus = {
        servers: listAllowedMcpServers(engine.home),
      }
      return c.json(mcpTrustStatusSchema.parse(body), 200)
    })
    .put("/mcp-trust", zValidator("json", putMcpTrustBodySchema), (c) => {
      const { key, grant } = c.req.valid("json")
      if (grant === "always") {
        allowMcpServerAlways(engine.home, key)
      } else if (grant === "once") {
        allowMcpServerOnce(key)
      } else {
        revokeMcpServer(engine.home, key)
      }
      const body: McpTrustStatus = {
        servers: listAllowedMcpServers(engine.home),
      }
      return c.json(mcpTrustStatusSchema.parse(body), 200)
    })
}
