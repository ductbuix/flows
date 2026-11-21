import { zValidator } from "@hono/zod-validator"
import {
  diffWorkCopy,
  runDir,
  workflowDir,
  type Engine,
} from "@workspace/engine"
import {
  connectionIdSchema,
  runChangesResponseSchema,
  type RunChangesResponse,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"

const changesParam = z.object({
  runId: z.string().min(1),
  connectionId: connectionIdSchema,
})

/** GET /runs/:runId/changes/:connectionId (DES-026 / BL-048). */
export function runChangesRoutes(engine: Engine) {
  return new Hono().get(
    "/runs/:runId/changes/:connectionId",
    zValidator("param", changesParam),
    async (c) => {
      const { runId, connectionId } = c.req.valid("param")
      const state = engine.fold(runId)
      if (!state || state.deleted) {
        return c.json({ message: "run not found" }, 404)
      }
      const root = runDir(workflowDir(engine.home, state.workflowId), runId)
      try {
        const result = await diffWorkCopy({
          home: engine.home,
          runRoot: root,
          connectionId,
        })
        return c.json(
          runChangesResponseSchema.parse(result) satisfies RunChangesResponse,
          200
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : "diff failed"
        const status = /unknown connection|unknown connector/.test(message)
          ? 404
          : 400
        return c.json({ message }, status)
      }
    }
  )
}
