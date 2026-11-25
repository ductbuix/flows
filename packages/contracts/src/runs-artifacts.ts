import { z } from "zod"

/** `events` is the NDJSON activity log (commands, tool calls, results). */
export const logStreamSchema = z.enum(["stdout", "stderr", "events"])

export const logChunkSchema = z.object({
  stream: logStreamSchema,
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative(),
  text: z.string(),
  eof: z.boolean(),
})

export type LogChunk = z.infer<typeof logChunkSchema>

export const summaryResponseSchema = z.object({
  text: z.string().nullable(),
  missing: z.boolean(),
})

export type SummaryResponse = z.infer<typeof summaryResponseSchema>

export const outFileSchema = z.object({
  path: z.string().min(1),
  type: z.enum(["file", "dir"]),
})

export const outListSchema = z.object({
  files: z.array(outFileSchema),
})

export type OutList = z.infer<typeof outListSchema>
