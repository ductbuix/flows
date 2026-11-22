import { z } from "zod"
import { retrySchema, timeoutSecondsSchema } from "../workflow.ts"

/** Settings shared by step kinds (DES-032). */
export const stepSettings = {
  timeout: timeoutSecondsSchema.optional(),
  retry: retrySchema.optional(),
}

/** Named answer declaration (DES-032), up to 20 per node. */
export const answerDeclSchema = z.strictObject({
  name: z.string().min(1),
  type: z.enum(["text", "number", "yesno", "list", "choice"]),
  labels: z.array(z.string().min(1)).min(1).optional(),
})

export const answersSchema = z.array(answerDeclSchema).max(20)
