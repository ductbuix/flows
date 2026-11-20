import { zValidator } from "@hono/zod-validator"
import {
  putWorkflowFileBodySchema,
  workflowFileConflictSchema,
  workflowFileDetailSchema,
  type WorkflowFileDetail,
} from "@workspace/shared"
import type { Engine } from "@workspace/engine"
import { Hono } from "hono"
import { z } from "zod"
import {
  readWorkflowScopedFile,
  writeWorkflowScopedFile,
} from "./workflow-scoped-files.ts"

const fileParam = z.object({
  workflowId: z.string().min(1),
  path: z.string().min(1),
})

/** GET/PUT workflow-relative text files (DES-018). */
export function fileRoutes(engine: Engine) {
  return new Hono()
    .get(
      "/workflows/:workflowId/files/:path{.+}",
      zValidator("param", fileParam),
      (c) => {
        const { workflowId, path: rel } = c.req.valid("param")
        const detail = readWorkflowScopedFile(engine, workflowId, rel)
        if (!detail) return c.json({ message: "not found" }, 404)
        return c.json(
          workflowFileDetailSchema.parse(detail) satisfies WorkflowFileDetail,
          200
        )
      }
    )
    .put(
      "/workflows/:workflowId/files/:path{.+}",
      zValidator("param", fileParam),
      zValidator("json", putWorkflowFileBodySchema),
      (c) => {
        const { workflowId, path: rel } = c.req.valid("param")
        const body = c.req.valid("json")
        const result = writeWorkflowScopedFile(
          engine,
          workflowId,
          rel,
          body.content,
          body.baseHash
        )
        if (result.ok === false && result.kind === "hash_conflict") {
          return c.json(
            workflowFileConflictSchema.parse({
              message: "conflict",
              diskContent: result.diskContent,
              diskHash: result.diskHash,
            }),
            409
          )
        }
        if (result.ok === false) {
          const status = result.kind === "not_found" ? 404 : 400
          return c.json({ message: result.kind }, status)
        }
        return c.json(
          workflowFileDetailSchema.parse(
            result.detail
          ) satisfies WorkflowFileDetail,
          200
        )
      }
    )
}
