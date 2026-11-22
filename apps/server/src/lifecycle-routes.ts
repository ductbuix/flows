import { zValidator } from "@hono/zod-validator"
import {
  createWorkflowBodySchema,
  memoryConflictSchema,
  memoryFileDetailSchema,
  memoryListSchema,
  putMemoryBodySchema,
  renameMemoryBodySchema,
  renameWorkflowBodySchema,
  renameWorkflowResponseSchema,
  workflowSummarySchema,
  type MemoryFileDetail,
  type MemoryList,
  type RenameWorkflowResponse,
  type WorkflowSummary,
} from "@workspace/shared"
import type { Engine } from "@workspace/engine"
import { Hono } from "hono"
import { z } from "zod"
import {
  deleteMemoryFile,
  listMemoryFiles,
  readMemoryFile,
  renameMemoryFile,
  writeMemoryFile,
} from "./memory-files.ts"
import {
  createWorkflow,
  deleteWorkflow,
  renameWorkflow,
} from "./workflow-lifecycle.ts"
import type { WsHub } from "./ws-hub.ts"

const idParam = z.object({ workflowId: z.string().min(1) })
const memoryParam = z.object({
  workflowId: z.string().min(1),
  file: z.string().min(1),
})

export function lifecycleRoutes(engine: Engine, hub: WsHub) {
  return new Hono()
    .post("/workflows", zValidator("json", createWorkflowBodySchema), (c) => {
      const body = c.req.valid("json")
      const result = createWorkflow(engine, body.id, body.goal, body.name)
      if (result.ok === false) {
        const status =
          result.kind === "exists" ? 409 : result.kind === "invalid" ? 400 : 400
        return c.json({ message: result.kind }, status)
      }
      return c.json(
        workflowSummarySchema.parse(result.summary) satisfies WorkflowSummary,
        201
      )
    })
    .post(
      "/workflows/:workflowId/rename",
      zValidator("param", idParam),
      zValidator("json", renameWorkflowBodySchema),
      (c) => {
        const { workflowId } = c.req.valid("param")
        const { newId } = c.req.valid("json")
        const result = renameWorkflow(engine, workflowId, newId)
        if (result.ok === false) {
          const status =
            result.kind === "not_found"
              ? 404
              : result.kind === "live" || result.kind === "exists"
                ? 409
                : 400
          return c.json({ message: result.kind }, status)
        }
        hub.files.unwatch(workflowId)
        return c.json(
          renameWorkflowResponseSchema.parse({
            id: result.id,
          }) satisfies RenameWorkflowResponse,
          200
        )
      }
    )
    .delete("/workflows/:workflowId", zValidator("param", idParam), (c) => {
      const { workflowId } = c.req.valid("param")
      const result = deleteWorkflow(engine, workflowId)
      if (result.ok === false) {
        const status =
          result.kind === "not_found" ? 404 : result.kind === "live" ? 409 : 400
        return c.json({ message: result.kind }, status)
      }
      hub.files.unwatch(workflowId)
      return c.body(null, 204)
    })
    .get("/workflows/:workflowId/memory", zValidator("param", idParam), (c) => {
      const { workflowId } = c.req.valid("param")
      const files = listMemoryFiles(engine, workflowId)
      if (files === null) return c.json({ message: "workflow not found" }, 404)
      return c.json(memoryListSchema.parse({ files }) satisfies MemoryList, 200)
    })
    .get(
      "/workflows/:workflowId/memory/:file",
      zValidator("param", memoryParam),
      (c) => {
        const { workflowId, file } = c.req.valid("param")
        const detail = readMemoryFile(engine, workflowId, file)
        if (!detail) return c.json({ message: "not found" }, 404)
        return c.json(
          memoryFileDetailSchema.parse(detail) satisfies MemoryFileDetail,
          200
        )
      }
    )
    .put(
      "/workflows/:workflowId/memory/:file",
      zValidator("param", memoryParam),
      zValidator("json", putMemoryBodySchema),
      (c) => {
        const { workflowId, file } = c.req.valid("param")
        const body = c.req.valid("json")
        const result = writeMemoryFile(
          engine,
          workflowId,
          file,
          body.content,
          body.baseHash
        )
        if (result.ok === false && result.kind === "hash_conflict") {
          return c.json(
            memoryConflictSchema.parse({
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
        hub.files.noteWrite(
          workflowId,
          `memory/${result.detail.name}`,
          result.detail.hash
        )
        hub.files.watch(workflowId)
        return c.json(
          memoryFileDetailSchema.parse(
            result.detail
          ) satisfies MemoryFileDetail,
          200
        )
      }
    )
    .delete(
      "/workflows/:workflowId/memory/:file",
      zValidator("param", memoryParam),
      (c) => {
        const { workflowId, file } = c.req.valid("param")
        const result = deleteMemoryFile(engine, workflowId, file)
        if (result.ok === false) {
          const status = result.kind === "not_found" ? 404 : 400
          return c.json({ message: result.kind }, status)
        }
        return c.json({ referencedBy: result.referencedBy }, 200)
      }
    )
    .post(
      "/workflows/:workflowId/memory/:file/rename",
      zValidator("param", memoryParam),
      zValidator("json", renameMemoryBodySchema),
      (c) => {
        const { workflowId, file } = c.req.valid("param")
        const body = c.req.valid("json")
        const result = renameMemoryFile(
          engine,
          workflowId,
          file,
          body.newName,
          body.updateReferences === true
        )
        if (result.ok === false) {
          const status =
            result.kind === "not_found"
              ? 404
              : result.kind === "exists"
                ? 409
                : 400
          return c.json({ message: result.kind }, status)
        }
        return c.json(
          memoryFileDetailSchema.parse(
            result.detail
          ) satisfies MemoryFileDetail,
          200
        )
      }
    )
}
