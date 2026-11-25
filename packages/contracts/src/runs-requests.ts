import { z } from "zod"

export const startRunResponseSchema = z.object({
  runId: z.string().min(1),
  /** queued when over maxConcurrentRuns (DES-021). */
  status: z.enum(["queued", "running"]),
})

export type StartRunResponse = z.infer<typeof startRunResponseSchema>

/** Client request id for idempotent mutating actions (DES-011). */
export const requestIdBodySchema = z.object({
  requestId: z.string().min(1),
})

export type RequestIdBody = z.infer<typeof requestIdBodySchema>

export const okResponseSchema = z.object({
  ok: z.literal(true),
})

export type OkResponse = z.infer<typeof okResponseSchema>

export const apiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
})

export type ApiError = z.infer<typeof apiErrorSchema>
