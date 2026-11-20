import { upgradeWebSocket } from "@hono/node-server"
import { zValidator } from "@hono/zod-validator"
import type { Engine } from "@workspace/engine"
import {
  logChunkSchema,
  outListSchema,
  runDetailSchema,
  runSummarySchema,
  summaryResponseSchema,
  workflowSummarySchema,
  type Health,
  type LogChunk,
  type OutList,
  type RunDetail,
  type RunSummary,
  type SummaryResponse,
  type WorkflowSummary,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import { IdempotencyStore } from "./idempotency.ts"
import { buildRunDetail, buildRunSummaries } from "./run-detail.ts"
import {
  listOutFiles,
  readLogChunk,
  readSummary,
  resolveAttemptRoot,
} from "./run-files.ts"
import { createRunControls } from "./run-controls.ts"
import { listWorkflowSummaries } from "./workflows-fs.ts"
import { WsHub } from "./ws-hub.ts"

const idParam = z.object({ workflowId: z.string().min(1) })
const runParam = z.object({ runId: z.string().min(1) })
const attemptParams = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  n: z.coerce.number().int().positive(),
})
const logQuery = z.object({
  stream: z.enum(["stdout", "stderr"]),
  offset: z.coerce.number().int().nonnegative().optional(),
})

export function createApp({ engine }: { engine: Engine }) {
  const hub = new WsHub(engine)
  const idempotency = new IdempotencyStore()
  const controls = createRunControls({ engine, idempotency })

  return new Hono()
    .basePath("/api")
    .get("/health", (c) =>
      c.json({ ok: true, version: "0.0.1" } satisfies Health, 200)
    )
    .get("/workflows", (c) => {
      const items = listWorkflowSummaries(engine)
      return c.json(
        items.map((w) =>
          workflowSummarySchema.parse(w)
        ) satisfies WorkflowSummary[],
        200
      )
    })
    .get("/workflows/:workflowId/runs", zValidator("param", idParam), (c) => {
      const { workflowId } = c.req.valid("param")
      const items = buildRunSummaries(engine, workflowId)
      return c.json(
        items.map((r) => runSummarySchema.parse(r)) satisfies RunSummary[],
        200
      )
    })
    .route("/", controls)
    .get("/runs/:runId", zValidator("param", runParam), (c) => {
      const { runId } = c.req.valid("param")
      const detail = buildRunDetail(engine, runId)
      if (!detail) return c.json({ message: "run not found" }, 404)
      return c.json(runDetailSchema.parse(detail) satisfies RunDetail, 200)
    })
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
      "/ws",
      upgradeWebSocket(() => hub.connection())
    )
}

export type AppType = ReturnType<typeof createApp>
