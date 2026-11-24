import { z } from "zod"
import {
  workflowDetailSchema,
  workflowSummarySchema,
  yamlDiagnosticSchema,
} from "../api.ts"
import { workflowIdSchema } from "../api-lifecycle.ts"
import { layoutFileSchema } from "../nodes/layout.ts"
import { workflowSchema } from "../nodes/index.ts"
import { workflowNameSchema } from "../workflow.ts"
import { defineMethod, defineNotification } from "./define.ts"

const DEFAULT_LIST_LIMIT_MAX = 500
const fcpRequestKeySchema = z.string().uuid().optional()

export const workflowListParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(DEFAULT_LIST_LIMIT_MAX).optional(),
})

export const workflowListResultSchema = z.object({
  items: z.array(workflowSummarySchema),
  next: z.string().min(1).optional(),
})

export const workflowGetParamsSchema = z.object({
  id: z.string().min(1),
})

export const workflowGetResultSchema = workflowDetailSchema

export const workflowCreateParamsSchema = z.object({
  id: workflowIdSchema,
  goal: z.string().min(1),
  name: workflowNameSchema.optional(),
  requestKey: fcpRequestKeySchema,
})

export const workflowCreateResultSchema = workflowSummarySchema

export const workflowSaveParamsSchema = z.object({
  id: z.string().min(1),
  yaml: z.string(),
  baseHash: z.string().min(1),
  renames: z
    .array(z.object({ from: z.string().min(1), to: z.string().min(1) }))
    .optional(),
  requestKey: fcpRequestKeySchema,
})

export const workflowSaveResultSchema = workflowDetailSchema

export const workflowConflictCurrentSchema = z.object({
  yaml: z.string(),
  hash: z.string().min(1),
})

export const workflowRenameParamsSchema = z.object({
  id: z.string().min(1),
  newId: workflowIdSchema,
  requestKey: fcpRequestKeySchema,
})

export const workflowRenameResultSchema = z.object({
  id: workflowIdSchema,
})

export const workflowDeleteParamsSchema = z.object({
  id: z.string().min(1),
  requestKey: fcpRequestKeySchema,
})

export const workflowDeleteResultSchema = z.object({})

export const workflowSaveLayoutParamsSchema = z.object({
  id: z.string().min(1),
  layout: layoutFileSchema,
  requestKey: fcpRequestKeySchema,
})

export const workflowSaveLayoutResultSchema = layoutFileSchema

export const workflowValidateParamsSchema = z.object({
  yaml: z.string(),
})

export const workflowValidateResultSchema = z.object({
  workflow: workflowSchema.nullable(),
  errors: z.array(yamlDiagnosticSchema),
})

export const workflowListMethod = defineMethod({
  name: "workflow/list",
  params: workflowListParamsSchema,
  result: workflowListResultSchema,
  kind: "query",
})

export const workflowGetMethod = defineMethod({
  name: "workflow/get",
  params: workflowGetParamsSchema,
  result: workflowGetResultSchema,
  kind: "query",
})

export const workflowCreateMethod = defineMethod({
  name: "workflow/create",
  params: workflowCreateParamsSchema,
  result: workflowCreateResultSchema,
  kind: "command",
})

export const workflowSaveMethod = defineMethod({
  name: "workflow/save",
  params: workflowSaveParamsSchema,
  result: workflowSaveResultSchema,
  kind: "command",
})

export const workflowRenameMethod = defineMethod({
  name: "workflow/rename",
  params: workflowRenameParamsSchema,
  result: workflowRenameResultSchema,
  kind: "command",
})

export const workflowDeleteMethod = defineMethod({
  name: "workflow/delete",
  params: workflowDeleteParamsSchema,
  result: workflowDeleteResultSchema,
  kind: "command",
})

export const workflowSaveLayoutMethod = defineMethod({
  name: "workflow/save_layout",
  params: workflowSaveLayoutParamsSchema,
  result: workflowSaveLayoutResultSchema,
  kind: "command",
})

export const workflowValidateMethod = defineMethod({
  name: "workflow/validate",
  params: workflowValidateParamsSchema,
  result: workflowValidateResultSchema,
  kind: "query",
})

/** Engine-to-client workflow stream (DES-040). */
export const workflowUpdateNotification = defineNotification({
  name: "workflow/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("workflow_changed"),
      workflowId: z.string().min(1),
      summary: workflowSummarySchema,
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("workflow_removed"),
      workflowId: z.string().min(1),
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("layout_changed"),
      workflowId: z.string().min(1),
      layout: layoutFileSchema,
    }),
  ]),
})
