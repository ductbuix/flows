import { z } from "zod"
import { workflowDetailSchema, workflowSummarySchema } from "../api.ts"
import { defineMethod } from "./define.ts"

const DEFAULT_LIST_LIMIT_MAX = 500

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
