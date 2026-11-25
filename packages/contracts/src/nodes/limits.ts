import { z } from "zod"

export const NODE_LIMIT = 200
export const EDGE_LIMIT = 400
export const DEFAULT_LOOP_PASSES = 5

export const nodeLimitsSchema = z.strictObject({
  concurrency: z.number().int().positive().optional(),
  agents: z.number().int().positive().optional(),
  maxConcurrentRuns: z.number().int().positive().optional(),
  /** Loop passes before a cycle stops (DES-034); default 5. */
  loopPasses: z.number().int().positive().default(DEFAULT_LOOP_PASSES),
})
