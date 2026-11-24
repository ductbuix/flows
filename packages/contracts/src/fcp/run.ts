import { z } from "zod"
import { runSummarySchema } from "../api.ts"
import { defineMethod, defineNotification } from "./define.ts"

const DEFAULT_LIMIT_MAX = 500

export const runListParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(DEFAULT_LIMIT_MAX).optional(),
})

export const runListResultSchema = z.object({
  items: z.array(runSummarySchema),
  next: z.string().min(1).optional(),
})

export const runGetParamsSchema = z.object({
  id: z.string().min(1),
})

export const runGetResultSchema = runSummarySchema

export const runListMethod = defineMethod({
  name: "run/list",
  params: runListParamsSchema,
  result: runListResultSchema,
  kind: "query",
})

export const runGetMethod = defineMethod({
  name: "run/get",
  params: runGetParamsSchema,
  result: runGetResultSchema,
  kind: "query",
})

/** Engine-to-client run stream; `run_changed` carries the list-row summary. */
export const runUpdateNotification = defineNotification({
  name: "run/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("run_changed"),
      runId: z.string().min(1),
      summary: runSummarySchema.nullable(),
    }),
  ]),
})
