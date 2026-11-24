import { z } from "zod"
import { retrySchema, timeoutSecondsSchema } from "../workflow.ts"

/** Settings shared by step kinds (DES-032). */
export const stepSettings = {
  timeout: timeoutSecondsSchema.optional(),
  retry: retrySchema.optional(),
}

/** A name that `{{name}}` can reach (DES-032). */
export const ANSWER_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Named answer declaration (DES-032), up to 20 per node. */
export const answerDeclSchema = z
  .strictObject({
    name: z
      .string()
      .regex(
        ANSWER_NAME_PATTERN,
        "answer name: letters, digits and _, not starting with a digit"
      ),
    type: z.enum(["text", "number", "yesno", "list", "choice"]),
    labels: z.array(z.string().min(1)).min(1).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "choice" && d.labels === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "choice needs labels",
        path: ["labels"],
      })
    }
    if (d.type !== "choice" && d.labels !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "labels are only for choice",
        path: ["labels"],
      })
    }
  })

export const answersSchema = z
  .array(answerDeclSchema)
  .max(20)
  .refine(
    (list) => new Set(list.map((d) => d.name)).size === list.length,
    "duplicate answer name"
  )

export type AnswerDecl = z.infer<typeof answerDeclSchema>
