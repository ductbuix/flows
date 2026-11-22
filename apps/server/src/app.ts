import { upgradeWebSocket } from "@hono/node-server"
import { zValidator } from "@hono/zod-validator"
import type { Engine } from "@workspace/engine"
import {
  putWorkflowBodySchema,
  runDetailSchema,
  runStatusSchema,
  runSummarySchema,
  workflowConflictSchema,
  workflowDetailSchema,
  workflowSummarySchema,
  type Health,
  type RunDetail,
  type RunSummary,
  type WorkflowDetail,
  type WorkflowSummary,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import { IdempotencyStore } from "./idempotency.ts"
import { buildRunDetail, buildRunSummaries } from "./run-detail.ts"
import { createRunControls } from "./run-controls.ts"
import {
  readNodeWorkflowDetail,
  writeNodeWorkflowYaml,
} from "./node-workflow-files.ts"
import { connectionRoutes } from "./connection-routes.ts"
import { libraryRoutes } from "./library-routes.ts"
import { fileRoutes } from "./file-routes.ts"
import { lifecycleRoutes } from "./lifecycle-routes.ts"
import { runAttemptRoutes } from "./run-attempt-routes.ts"
import { runChangesRoutes } from "./run-changes-routes.ts"
import { runInputRoutes } from "./run-input-routes.ts"
import { mcpTrustRoutes } from "./mcp-trust-routes.ts"
import { noticeRoutes } from "./notice-routes.ts"
import { trustRoutes } from "./trust-routes.ts"
import { listWorkflowSummaries } from "./workflows-fs.ts"
import { layoutRoutes } from "./layout-routes.ts"
import { workItemRoutes } from "./workitem-routes.ts"
import { WsHub } from "./ws-hub.ts"

const idParam = z.object({ workflowId: z.string().min(1) })
const runParam = z.object({ runId: z.string().min(1) })
const runsQuery = z.object({
  status: runStatusSchema.optional(),
  workflowId: z.string().min(1).optional(),
  workItemId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
})

export function createApp({ engine }: { engine: Engine }) {
  const hub = new WsHub(engine)
  const idempotency = new IdempotencyStore()
  const controls = createRunControls({ engine, idempotency })

  return new Hono()
    .basePath("/api")
    .route("/", lifecycleRoutes(engine, hub))
    .route("/", fileRoutes(engine))
    .route("/", runInputRoutes(engine))
    .route("/", runAttemptRoutes(engine))
    .route("/", runChangesRoutes(engine))
    .route("/", trustRoutes(engine))
    .route("/", mcpTrustRoutes(engine))
    .route("/", noticeRoutes(engine))
    .route("/", connectionRoutes(engine))
    .route("/", libraryRoutes(engine))
    .route("/", layoutRoutes(engine))
    .route("/", workItemRoutes(engine))
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
    .get("/workflows/:workflowId", zValidator("param", idParam), (c) => {
      const { workflowId } = c.req.valid("param")
      const detail = readNodeWorkflowDetail(engine, workflowId)
      if (!detail) return c.json({ message: "workflow not found" }, 404)
      return c.json(
        workflowDetailSchema.parse(detail) satisfies WorkflowDetail,
        200
      )
    })
    .put(
      "/workflows/:workflowId",
      zValidator("param", idParam),
      zValidator("json", putWorkflowBodySchema),
      (c) => {
        const { workflowId } = c.req.valid("param")
        const body = c.req.valid("json")
        const result = writeNodeWorkflowYaml(
          engine,
          workflowId,
          body.yaml,
          body.baseHash,
          body.renames
        )
        if (result.ok === false && result.kind === "not_found") {
          return c.json({ message: "workflow not found" }, 404)
        }
        if (result.ok === false && result.kind === "conflict") {
          return c.json(
            workflowConflictSchema.parse({
              message: "conflict",
              diskYaml: result.diskYaml,
              diskHash: result.diskHash,
            }),
            409
          )
        }
        if (result.ok === false && result.kind === "invalid") {
          return c.json(result.detail as WorkflowDetail, 400)
        }
        if (result.ok === false && result.kind === "trash_failed") {
          return c.json(
            {
              message: "failed to move removed task folder",
              path: result.path,
            },
            500
          )
        }
        hub.files.noteWrite(workflowId, "workflow.yaml", result.detail.hash)
        hub.files.watch(workflowId)
        return c.json(result.detail as WorkflowDetail, 200)
      }
    )
    .get("/workflows/:workflowId/runs", zValidator("param", idParam), (c) => {
      const { workflowId } = c.req.valid("param")
      const items = buildRunSummaries(engine, workflowId)
      return c.json(
        items.map((r) => runSummarySchema.parse(r)) satisfies RunSummary[],
        200
      )
    })
    .route("/", controls)
    .get("/runs", zValidator("query", runsQuery), (c) => {
      const query = c.req.valid("query")
      const items = engine.listRunSummaries(query)
      return c.json(
        items.map((r) => runSummarySchema.parse(r)) satisfies RunSummary[],
        200
      )
    })
    .get("/runs/:runId", zValidator("param", runParam), (c) => {
      const { runId } = c.req.valid("param")
      const detail = buildRunDetail(engine, runId)
      if (!detail) return c.json({ message: "run not found" }, 404)
      return c.json(runDetailSchema.parse(detail) satisfies RunDetail, 200)
    })
    .get(
      "/ws",
      upgradeWebSocket(() => hub.connection())
    )
}

export type AppType = ReturnType<typeof createApp>
