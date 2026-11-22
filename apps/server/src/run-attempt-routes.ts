import { zValidator } from "@hono/zod-validator"
import type { Engine } from "@workspace/engine"
import {
  logChunkSchema,
  outListSchema,
  runInputFileDetailSchema,
  summaryResponseSchema,
  type LogChunk,
  type OutList,
  type RunInputFileDetail,
  type SummaryResponse,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import {
  listOutFiles,
  readLogChunk,
  readOutTextFile,
  readSummary,
  resolveAttemptRoot,
} from "./run-files.ts"

const attemptParams = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  n: z.coerce.number().int().positive(),
})
const outFileParams = attemptParams.extend({
  path: z.string().min(1),
})
const logQuery = z.object({
  stream: z.enum(["stdout", "stderr"]),
  offset: z.coerce.number().int().nonnegative().optional(),
})

/** Attempt log, SUMMARY.md, and out/ list + file reads. */
export function runAttemptRoutes(engine: Engine) {
  return new Hono()
    .get(
      "/runs/:runId/tasks/:taskId/attempts/:n/log",
      zValidator("param", attemptParams),
      zValidator("query", logQuery),
      (c) => {
        const { runId, taskId, n } = c.req.valid("param")
        const { stream, offset: rawOffset } = c.req.valid("query")
        const offset = rawOffset ?? 0
        const attemptRoot = resolveAttemptRoot(engine, runId, taskId, n)
        if (!attemptRoot) return c.json({ message: "not found" }, 404)
        const chunk = readLogChunk(attemptRoot, stream, offset)
        return c.json(logChunkSchema.parse(chunk) satisfies LogChunk, 200)
      }
    )
    .get(
      "/runs/:runId/tasks/:taskId/attempts/:n/summary",
      zValidator("param", attemptParams),
      (c) => {
        const { runId, taskId, n } = c.req.valid("param")
        const attemptRoot = resolveAttemptRoot(engine, runId, taskId, n)
        if (!attemptRoot) return c.json({ message: "not found" }, 404)
        const summary = readSummary(attemptRoot)
        return c.json(
          summaryResponseSchema.parse(summary) satisfies SummaryResponse,
          200
        )
      }
    )
    .get(
      "/runs/:runId/tasks/:taskId/attempts/:n/out",
      zValidator("param", attemptParams),
      (c) => {
        const { runId, taskId, n } = c.req.valid("param")
        const attemptRoot = resolveAttemptRoot(engine, runId, taskId, n)
        if (!attemptRoot) return c.json({ message: "not found" }, 404)
        const out = listOutFiles(attemptRoot)
        return c.json(outListSchema.parse(out) satisfies OutList, 200)
      }
    )
    .get(
      "/runs/:runId/tasks/:taskId/attempts/:n/out/:path{.+}",
      zValidator("param", outFileParams),
      (c) => {
        const { runId, taskId, n, path: rel } = c.req.valid("param")
        const attemptRoot = resolveAttemptRoot(engine, runId, taskId, n)
        if (!attemptRoot) return c.json({ message: "not found" }, 404)
        const detail = readOutTextFile(attemptRoot, rel)
        if (!detail) return c.json({ message: "not found" }, 404)
        return c.json(
          runInputFileDetailSchema.parse(detail) satisfies RunInputFileDetail,
          200
        )
      }
    )
}
