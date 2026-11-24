import { z } from "zod"
import { defineMethod } from "./define.ts"

/** Topic id for a namespace stream (`docket`) or a scoped stream (`run:r-1`). */
export const fcpTopicSchema = z.string().min(1)

export const subscribeParamsSchema = z.object({
  topics: z.array(fcpTopicSchema).min(1),
  since: z.number().int().nonnegative().optional(),
})

export const subscribeResultSchema = z.object({
  seq: z.number().int().nonnegative(),
  resync: z.array(fcpTopicSchema),
})

export const unsubscribeParamsSchema = z.object({
  topics: z.array(fcpTopicSchema).min(1),
})

export const unsubscribeResultSchema = z.object({})

export const subscribeMethod = defineMethod({
  name: "subscribe",
  params: subscribeParamsSchema,
  result: subscribeResultSchema,
  kind: "command",
})

export const unsubscribeMethod = defineMethod({
  name: "unsubscribe",
  params: unsubscribeParamsSchema,
  result: unsubscribeResultSchema,
  kind: "command",
})

/** `run` topic subscribers receive only these kinds (DES-040). */
export const RUN_LIGHT_KINDS = ["run_changed", "step_state"] as const
