import { zValidator } from "@hono/zod-validator"
import type { Engine } from "@workspace/engine"
import { layoutFileSchema } from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import { readLayout, writeLayout } from "./layout-files.ts"
import { nodesEnabled } from "./node-workflow-files.ts"
import { workflowYamlPath } from "./workflow-files.ts"
import { existsSync } from "node:fs"

const param = z.object({ workflowId: z.string().min(1) })

/** GET/PUT /workflows/:id/layout behind FLOWS_NODES (BL-092). */
export function layoutRoutes(engine: Engine) {
  return new Hono()
    .get("/workflows/:workflowId/layout", zValidator("param", param), (c) => {
      const { workflowId } = c.req.valid("param")
      if (!nodesEnabled() || !existsSync(workflowYamlPath(engine, workflowId))) {
        return c.json({ message: "workflow not found" }, 404)
      }
      return c.json(readLayout(engine, workflowId), 200)
    })
    .put(
      "/workflows/:workflowId/layout",
      zValidator("param", param),
      zValidator("json", layoutFileSchema),
      (c) => {
        const { workflowId } = c.req.valid("param")
        if (!nodesEnabled()) return c.json({ message: "workflow not found" }, 404)
        const written = writeLayout(engine, workflowId, c.req.valid("json"))
        if (!written) return c.json({ message: "workflow not found" }, 404)
        return c.json(written, 200)
      }
    )
}
