import { z } from "zod"
import { defineMethod } from "./define.ts"

const DEFAULT_LIST_LIMIT_MAX = 500
const fcpRequestKeySchema = z.string().uuid().optional()

export const fileKindSchema = z.enum(["file", "dir"])

export const fileEntrySchema = z.object({
  path: z.string(),
  kind: fileKindSchema,
})

export const fileListParamsSchema = z.object({
  /** Store-relative directory prefix; omit or "" for the workspace root. */
  path: z.string().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(DEFAULT_LIST_LIMIT_MAX).optional(),
})

export const fileListResultSchema = z.object({
  items: z.array(fileEntrySchema),
  next: z.string().min(1).optional(),
})

export const fileStatParamsSchema = z.object({
  path: z.string().min(1),
})

export const fileStatResultSchema = z.object({
  path: z.string(),
  kind: fileKindSchema,
  hash: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
})

export const fileReadTextParamsSchema = z.object({
  path: z.string().min(1),
})

export const fileReadTextResultSchema = z.object({
  path: z.string(),
  text: z.string(),
  hash: z.string(),
})

export const fileWriteTextParamsSchema = z.object({
  path: z.string().min(1),
  text: z.string(),
  baseHash: z.string().optional(),
  requestKey: fcpRequestKeySchema,
})

export const fileWriteTextResultSchema = z.object({
  path: z.string(),
  hash: z.string(),
})

export const fileRevealParamsSchema = z.object({
  path: z.string().min(1),
})

export const fileRevealResultSchema = z.object({})

export const fileListMethod = defineMethod({
  name: "file/list",
  params: fileListParamsSchema,
  result: fileListResultSchema,
  kind: "query",
})

export const fileStatMethod = defineMethod({
  name: "file/stat",
  params: fileStatParamsSchema,
  result: fileStatResultSchema,
  kind: "query",
})

export const fileReadTextMethod = defineMethod({
  name: "file/read_text",
  params: fileReadTextParamsSchema,
  result: fileReadTextResultSchema,
  kind: "query",
})

export const fileWriteTextMethod = defineMethod({
  name: "file/write_text",
  params: fileWriteTextParamsSchema,
  result: fileWriteTextResultSchema,
  kind: "command",
})

export const fileRevealMethod = defineMethod({
  name: "file/reveal",
  params: fileRevealParamsSchema,
  result: fileRevealResultSchema,
  kind: "command",
})
