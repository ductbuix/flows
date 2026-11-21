import { zValidator } from "@hono/zod-validator"
import {
  createWorkItem,
  deleteWorkItem,
  deleteWorkItemAttachment,
  listWorkItemAttachments,
  listWorkItemSummaries,
  readWorkItem,
  readWorkItemNotes,
  updateWorkItem,
  writeWorkItemAttachment,
  writeWorkItemNotes,
  type Engine,
} from "@workspace/engine"
import {
  createWorkItemBodySchema,
  putWorkItemBodySchema,
  putWorkItemNotesBodySchema,
  workItemAttachmentListSchema,
  workItemAttachmentSchema,
  workItemConflictSchema,
  workItemDetailSchema,
  workItemNotesConflictSchema,
  workItemNotesSchema,
  workItemSummarySchema,
  type WorkItemAttachment,
  type WorkItemAttachmentList,
  type WorkItemDetail,
  type WorkItemNotes,
  type WorkItemSummary,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"

const idParam = z.object({ id: z.string().min(1) })
const attachmentParam = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

/** Work item CRUD, notes and attachments (DES-026 / BL-038). */
export function workItemRoutes(engine: Engine) {
  return new Hono()
    .get("/workitems", (c) => {
      const items = listWorkItemSummaries(engine.home)
      return c.json(
        items.map((w) =>
          workItemSummarySchema.parse(w)
        ) satisfies WorkItemSummary[],
        200
      )
    })
    .post("/workitems", zValidator("json", createWorkItemBodySchema), (c) => {
      const body = c.req.valid("json")
      const created = createWorkItem(engine.home, body)
      return c.json(
        workItemDetailSchema.parse({
          item: created.item,
          hash: created.hash,
        }) satisfies WorkItemDetail,
        201
      )
    })
    .get("/workitems/:id", zValidator("param", idParam), (c) => {
      const { id } = c.req.valid("param")
      const loaded = readWorkItem(engine.home, id)
      if (!loaded) return c.json({ message: "work item not found" }, 404)
      return c.json(
        workItemDetailSchema.parse({
          item: loaded.item,
          hash: loaded.hash,
        }) satisfies WorkItemDetail,
        200
      )
    })
    .put(
      "/workitems/:id",
      zValidator("param", idParam),
      zValidator("json", putWorkItemBodySchema),
      (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const result = updateWorkItem(engine.home, id, body)
        if (result.ok === false && result.kind === "not_found") {
          return c.json({ message: "work item not found" }, 404)
        }
        if (result.ok === false && result.kind === "conflict") {
          return c.json(
            workItemConflictSchema.parse({
              message: "conflict",
              diskItem: result.item,
              diskHash: result.hash,
            }),
            409
          )
        }
        return c.json(
          workItemDetailSchema.parse({
            item: result.item,
            hash: result.hash,
          }) satisfies WorkItemDetail,
          200
        )
      }
    )
    .delete("/workitems/:id", zValidator("param", idParam), (c) => {
      const { id } = c.req.valid("param")
      const result = deleteWorkItem(engine.home, id)
      if (result.ok === false) {
        return c.json({ message: "work item not found" }, 404)
      }
      return c.body(null, 204)
    })
    .get("/workitems/:id/notes", zValidator("param", idParam), (c) => {
      const { id } = c.req.valid("param")
      const notes = readWorkItemNotes(engine.home, id)
      if (!notes) return c.json({ message: "work item not found" }, 404)
      return c.json(
        workItemNotesSchema.parse(notes) satisfies WorkItemNotes,
        200
      )
    })
    .put(
      "/workitems/:id/notes",
      zValidator("param", idParam),
      zValidator("json", putWorkItemNotesBodySchema),
      (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const result = writeWorkItemNotes(
          engine.home,
          id,
          body.content,
          body.baseHash
        )
        if (result.ok === false && result.kind === "not_found") {
          return c.json({ message: "work item not found" }, 404)
        }
        if (result.ok === false && result.kind === "conflict") {
          return c.json(
            workItemNotesConflictSchema.parse({
              message: "conflict",
              diskContent: result.content,
              diskHash: result.hash,
            }),
            409
          )
        }
        return c.json(
          workItemNotesSchema.parse({
            content: result.content,
            hash: result.hash,
          }) satisfies WorkItemNotes,
          200
        )
      }
    )
    .get("/workitems/:id/attachments", zValidator("param", idParam), (c) => {
      const { id } = c.req.valid("param")
      const files = listWorkItemAttachments(engine.home, id)
      if (files === null) {
        return c.json({ message: "work item not found" }, 404)
      }
      return c.json(
        workItemAttachmentListSchema.parse({
          files,
        }) satisfies WorkItemAttachmentList,
        200
      )
    })
    .post(
      "/workitems/:id/attachments",
      zValidator("param", idParam),
      async (c) => {
        const { id } = c.req.valid("param")
        const form = await c.req.parseBody({ all: true })
        const raw = form.file
        const part = Array.isArray(raw) ? raw[0] : raw
        if (!part || typeof part === "string" || !("arrayBuffer" in part)) {
          return c.json({ message: "file is required" }, 400)
        }
        const file = part as File
        const name = file.name || "upload"
        const data = Buffer.from(await file.arrayBuffer())
        const result = writeWorkItemAttachment(engine.home, id, name, data)
        if (result.ok === false) {
          const status = result.kind === "not_found" ? 404 : 400
          return c.json({ message: result.kind }, status)
        }
        return c.json(
          workItemAttachmentSchema.parse(
            result.attachment
          ) satisfies WorkItemAttachment,
          201
        )
      }
    )
    .delete(
      "/workitems/:id/attachments/:name",
      zValidator("param", attachmentParam),
      (c) => {
        const { id, name } = c.req.valid("param")
        const result = deleteWorkItemAttachment(engine.home, id, name)
        if (result.ok === false) {
          const status = result.kind === "invalid" ? 400 : 404
          return c.json({ message: result.kind }, status)
        }
        return c.body(null, 204)
      }
    )
}
