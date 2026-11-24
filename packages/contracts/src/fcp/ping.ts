import { z } from "zod"
import { defineMethod } from "./define.ts"

export const pingParamsSchema = z.object({})

export const pingResultSchema = z.object({
  ok: z.literal(true),
})

export const pingMethod = defineMethod({
  name: "ping",
  params: pingParamsSchema,
  result: pingResultSchema,
  kind: "query",
})
