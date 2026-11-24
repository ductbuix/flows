import { z } from "zod"
import {
  logChunkSchema,
  logStreamSchema,
  runStepSchema,
  runSummarySchema,
} from "../runs.ts"
import { connectionIdSchema } from "../ids.ts"
import { runChangesResponseSchema } from "../publish.ts"
import { runStatusSchema } from "../events.ts"
import { cardIdSchema } from "../docket/schemas.ts"
import { trustGrantSchema } from "../trust.ts"
import { defineMethod, defineNotification } from "./define.ts"
import { runUpdateAgentKinds } from "./run-update-kinds.ts"

const DEFAULT_LIMIT_MAX = 500
const fcpRequestKeySchema = z.string().uuid().optional()

export const runListParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(DEFAULT_LIMIT_MAX).optional(),
  /** Docket card id (DES-038, BL-200). */
  cardId: cardIdSchema.optional(),
  /** Filter to one workflow (BL-203). */
  workflowId: z.string().min(1).optional(),
})

export const runListResultSchema = z.object({
  items: z.array(runSummarySchema),
  next: z.string().min(1).optional(),
})

export const runGetParamsSchema = z.object({
  id: z.string().min(1),
})

/** Summary plus latest step per node for canvas run view (BL-203). */
export const runGetResultSchema = runSummarySchema.extend({
  steps: z.array(runStepSchema).optional(),
})

export const runStartParamsSchema = z.object({
  workflowId: z.string().min(1),
  requestKey: fcpRequestKeySchema,
  values: z.record(z.string(), z.string()).optional(),
  cardId: cardIdSchema.optional(),
  refreshPins: z.boolean().optional(),
  only: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  baseRunId: z.string().min(1).optional(),
  trustGrant: trustGrantSchema.optional(),
})

export const runStartResultSchema = z.object({
  runId: z.string().min(1),
})

export const runCancelParamsSchema = z.object({
  runId: z.string().min(1),
  requestKey: fcpRequestKeySchema,
})

export const runCancelResultSchema = z.object({})

export const runRerunParamsSchema = z.object({
  runId: z.string().min(1),
  requestKey: fcpRequestKeySchema,
  values: z.record(z.string(), z.string()).optional(),
  refreshPins: z.boolean().optional(),
  only: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  baseRunId: z.string().min(1).optional(),
})

export const runRerunResultSchema = z.object({
  runId: z.string().min(1),
})

export const runRetryStepParamsSchema = z.object({
  runId: z.string().min(1),
  stepId: z.string().min(1),
  requestKey: fcpRequestKeySchema,
})

export const runRetryStepResultSchema = z.object({})

export const runDeleteParamsSchema = z.object({
  runId: z.string().min(1),
  requestKey: fcpRequestKeySchema,
})

export const runDeleteResultSchema = z.object({})

export const runGetLogParamsSchema = z.object({
  runId: z.string().min(1),
  stepId: z.string().min(1),
  attempt: z.number().int().positive(),
  stream: logStreamSchema,
  offset: z.number().int().nonnegative().optional(),
})

export const runGetLogResultSchema = logChunkSchema

export const runGetChangesParamsSchema = z.object({
  runId: z.string().min(1),
  connectionId: connectionIdSchema,
})

export const runGetChangesResultSchema = runChangesResponseSchema

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

export const runStartMethod = defineMethod({
  name: "run/start",
  params: runStartParamsSchema,
  result: runStartResultSchema,
  kind: "command",
})

export const runCancelMethod = defineMethod({
  name: "run/cancel",
  params: runCancelParamsSchema,
  result: runCancelResultSchema,
  kind: "command",
})

export const runRerunMethod = defineMethod({
  name: "run/rerun",
  params: runRerunParamsSchema,
  result: runRerunResultSchema,
  kind: "command",
})

export const runRetryStepMethod = defineMethod({
  name: "run/retry_step",
  params: runRetryStepParamsSchema,
  result: runRetryStepResultSchema,
  kind: "command",
})

export const runDeleteMethod = defineMethod({
  name: "run/delete",
  params: runDeleteParamsSchema,
  result: runDeleteResultSchema,
  kind: "command",
})

export const runGetLogMethod = defineMethod({
  name: "run/get_log",
  params: runGetLogParamsSchema,
  result: runGetLogResultSchema,
  kind: "query",
})

export const runGetChangesMethod = defineMethod({
  name: "run/get_changes",
  params: runGetChangesParamsSchema,
  result: runGetChangesResultSchema,
  kind: "query",
})

/** Engine-to-client run stream (DES-040). */
export const runUpdateNotification = defineNotification({
  name: "run/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("run_changed"),
      runId: z.string().min(1),
      summary: runSummarySchema.nullable(),
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("step_state"),
      runId: z.string().min(1),
      step: runStepSchema,
    }),
    ...runUpdateAgentKinds,
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("run_finished"),
      runId: z.string().min(1),
      status: runStatusSchema,
      summary: runSummarySchema.nullable(),
    }),
  ]),
})
