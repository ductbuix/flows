import { zValidator } from "@hono/zod-validator"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import {
  okResponseSchema,
  startRunBodySchema,
  startRunResponseSchema,
  trustRequiredErrorSchema,
  type OkResponse,
  type StartRunResponse,
  type TrustRequiredError,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import {
  errorJson,
  mapEngineError,
  withIdempotency,
} from "./control-helpers.ts"
import type { IdempotencyStore } from "./idempotency.ts"

const runParam = z.object({ runId: z.string().min(1) })
const taskParam = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
})
const workflowParam = z.object({ workflowId: z.string().min(1) })

function ok(c: { json: (body: OkResponse, status: 200) => Response }) {
  return c.json(okResponseSchema.parse({ ok: true } satisfies OkResponse), 200)
}

async function trustRequired(
  c: { json: (body: TrustRequiredError, status: 409) => Response },
  engine: Engine,
  dir: string
) {
  const pre = await engine.preflight({ workflowDir: dir })
  const body: TrustRequiredError = {
    error: "trust_required",
    message: "Trust is required before starting an agent CLI run",
    trust: "none",
    checks: pre.checks,
  }
  return c.json(trustRequiredErrorSchema.parse(body), 409)
}

function isTrustRequired(err: unknown): boolean {
  return err instanceof Error && err.message === "trust_required"
}

/** Mutating run-control routes (DES-011 / BL-012 / DES-019). */
export function createRunControls({
  engine,
  idempotency,
}: {
  engine: Engine
  idempotency: IdempotencyStore
}) {
  return new Hono()
    .post(
      "/workflows/:workflowId/runs",
      zValidator("param", workflowParam),
      zValidator("json", startRunBodySchema),
      async (c) => {
        const { workflowId } = c.req.valid("param")
        const { requestId, trustGrant } = c.req.valid("json")
        return withIdempotency(c, idempotency, requestId, async () => {
          const dir = workflowDir(engine.home, workflowId)
          if (!existsSync(join(dir, "workflow.yaml"))) {
            return errorJson(c, 404, "not_found", "workflow not found")
          }
          try {
            const handle = engine.startRun({
              workflowDir: dir,
              trustGrant,
            })
            const body: StartRunResponse = { runId: handle.runId }
            return c.json(startRunResponseSchema.parse(body), 200)
          } catch (err) {
            if (isTrustRequired(err)) return trustRequired(c, engine, dir)
            return mapEngineError(c, err)
          }
        })
      }
    )
    .post(
      "/runs/:runId/cancel",
      zValidator("param", runParam),
      zValidator("json", startRunBodySchema.pick({ requestId: true })),
      async (c) => {
        const { runId } = c.req.valid("param")
        const { requestId } = c.req.valid("json")
        return withIdempotency(c, idempotency, requestId, () => {
          try {
            engine.cancelRun(runId)
            return ok(c)
          } catch (err) {
            return mapEngineError(c, err)
          }
        })
      }
    )
    .post(
      "/runs/:runId/rerun",
      zValidator("param", runParam),
      zValidator("json", startRunBodySchema),
      async (c) => {
        const { runId } = c.req.valid("param")
        const { requestId, trustGrant } = c.req.valid("json")
        return withIdempotency(c, idempotency, requestId, async () => {
          const state = engine.fold(runId)
          if (!state || state.deleted) {
            return errorJson(c, 404, "not_found", "run not found")
          }
          if (state.status === "running") {
            return errorJson(c, 409, "conflict", "run is still live")
          }
          const dir = workflowDir(engine.home, state.workflowId)
          try {
            const handle = engine.startRun({
              workflowDir: dir,
              trustGrant,
            })
            const body: StartRunResponse = { runId: handle.runId }
            return c.json(startRunResponseSchema.parse(body), 200)
          } catch (err) {
            if (isTrustRequired(err)) return trustRequired(c, engine, dir)
            return mapEngineError(c, err)
          }
        })
      }
    )
    .post(
      "/runs/:runId/tasks/:taskId/retry",
      zValidator("param", taskParam),
      zValidator("json", startRunBodySchema.pick({ requestId: true })),
      async (c) => {
        const { runId, taskId } = c.req.valid("param")
        const { requestId } = c.req.valid("json")
        return withIdempotency(c, idempotency, requestId, () => {
          try {
            engine.retryTask(runId, taskId)
            return ok(c)
          } catch (err) {
            return mapEngineError(c, err)
          }
        })
      }
    )
    .post(
      "/runs/:runId/tasks/:taskId/approve",
      zValidator("param", taskParam),
      zValidator("json", startRunBodySchema.pick({ requestId: true })),
      async (c) => {
        const { runId, taskId } = c.req.valid("param")
        const { requestId } = c.req.valid("json")
        return withIdempotency(c, idempotency, requestId, () => {
          try {
            engine.approveTask(runId, taskId)
            return ok(c)
          } catch (err) {
            return mapEngineError(c, err)
          }
        })
      }
    )
    .post(
      "/runs/:runId/tasks/:taskId/reject",
      zValidator("param", taskParam),
      zValidator("json", startRunBodySchema.pick({ requestId: true })),
      async (c) => {
        const { runId, taskId } = c.req.valid("param")
        const { requestId } = c.req.valid("json")
        return withIdempotency(c, idempotency, requestId, () => {
          try {
            engine.rejectTask(runId, taskId)
            return ok(c)
          } catch (err) {
            return mapEngineError(c, err)
          }
        })
      }
    )
    .delete(
      "/runs/:runId",
      zValidator("param", runParam),
      zValidator("json", startRunBodySchema.pick({ requestId: true })),
      async (c) => {
        const { runId } = c.req.valid("param")
        const { requestId } = c.req.valid("json")
        return withIdempotency(c, idempotency, requestId, () => {
          try {
            engine.deleteRun(runId)
            return ok(c)
          } catch (err) {
            return mapEngineError(c, err)
          }
        })
      }
    )
}
