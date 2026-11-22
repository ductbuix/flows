import { zValidator } from "@hono/zod-validator"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  workflowDir,
  workItemItemKey,
  type Engine,
  type ManualFilePart,
} from "@workspace/engine"
import {
  okResponseSchema,
  startRunBodySchema,
  startRunResponseSchema,
  trustRequiredErrorSchema,
  type OkResponse,
  type StartRunBody,
  type NodeWorkflow,
  type StartRunResponse,
  type TrustRequiredError,
  type WorkflowInputDecl,
} from "@workspace/shared"
import { parseNodeWorkflowYaml } from "@workspace/shared"
import { Hono, type Context } from "hono"
import { z } from "zod"
import {
  errorJson,
  mapEngineError,
  withIdempotency,
} from "./control-helpers.ts"
import type { IdempotencyStore } from "./idempotency.ts"
import { nodesEnabled } from "./node-workflow-files.ts"
import {
  duplicateInputResponse,
  parseStartRequest,
  resolveStartWorkItem,
  validateStartInput,
} from "./start-run-input.ts"

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

/** Inputs declared on the Trigger a node run starts from (BL-104). */
function triggerInputs(graph: NodeWorkflow): WorkflowInputDecl[] {
  const trigger = graph.nodes.find((n) => n.kind === "trigger")
  const inputs = trigger && "inputs" in trigger ? trigger.inputs : undefined
  return (inputs as WorkflowInputDecl[] | undefined) ?? []
}

/**
 * Node run start (BL-093): the graph is read from `workflow.yaml`, frozen
 * by the engine. `values.text` is the run input text (`input/text.md`).
 */
async function startNodeRoute(
  c: Context,
  engine: Engine,
  dir: string,
  workflowId: string,
  body: StartRunBody,
  files: ManualFilePart[],
  rerunOf?: { runId: string; workItemId?: string }
): Promise<Response> {
  const parsed = parseNodeWorkflowYaml(
    readFileSync(join(dir, "workflow.yaml"), "utf8")
  )
  if (!parsed.workflow || parsed.errors.length > 0) {
    return errorJson(
      c,
      400,
      "bad_request",
      parsed.errors[0]?.message ?? "invalid workflow"
    )
  }
  const partial =
    body.only !== undefined || body.from !== undefined
      ? { only: body.only, from: body.from, baseRunId: body.baseRunId }
      : undefined
  // A partial run keeps the inputs of the run it builds on (BL-102).
  const base = partial
    ? engine.latestNodeRunId(workflowId, partial.baseRunId)
    : undefined
  const decls = triggerInputs(parsed.workflow)
  const keepInputs = base !== undefined
  const validated = keepInputs
    ? { values: {} as Record<string, string> }
    : validateStartInput(c, decls, body.values, files)
  if (validated instanceof Response) return validated
  const linked = resolveStartWorkItem(
    c,
    engine,
    rerunOf ? rerunOf.workItemId : body.workItemId,
    ""
  )
  if (linked instanceof Response) return linked
  const withInputs = !keepInputs && (decls.length > 0 || files.length > 0)
  try {
    // Asset resources are pulled and pinned before the run starts (BL-082).
    const runId = randomUUID()
    const pinFromRunId = rerunOf?.runId ?? base
    const pins = await engine.pinNodeRun({
      graph: parsed.workflow,
      runId,
      workItemId: linked.workItemId,
      ...(pinFromRunId !== undefined ? { pinFromRunId } : {}),
      refreshPins: body.refreshPins,
    })
    const handle = engine.startNodeRun({
      graph: parsed.workflow,
      runId,
      pins,
      ...(partial ? { partial } : {}),
      // Without declared inputs the whole start text is `input/text.md`.
      inputText:
        keepInputs || decls.length > 0 ? undefined : body.values?.text,
      ...(withInputs
        ? { inputs: { decls, values: validated.values, files } }
        : {}),
      workItemId: linked.workItemId,
    })
    void handle.wait().catch(() => undefined)
    const resBody: StartRunResponse = {
      runId: handle.runId,
      status: handle.status,
    }
    return c.json(startRunResponseSchema.parse(resBody), 200)
  } catch (err) {
    return mapEngineError(c, err)
  }
}

/** Mutating run-control routes (DES-011 / BL-012 / DES-019 / DES-021). */
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
      async (c) => {
        const { workflowId } = c.req.valid("param")
        const dir = workflowDir(engine.home, workflowId)
        if (!existsSync(join(dir, "workflow.yaml"))) {
          return errorJson(c, 404, "not_found", "workflow not found")
        }
        const parsed = await parseStartRequest(c)
        if (parsed instanceof Response) return parsed
        const { body, files } = parsed

        if (nodesEnabled()) {
          return withIdempotency(c, idempotency, body.requestId, () =>
            startNodeRoute(c, engine, dir, workflowId, body, files)
          )
        }

        return withIdempotency(c, idempotency, body.requestId, async () => {
          let workflow
          try {
            workflow = engine.loadWorkflow(dir)
          } catch (err) {
            return mapEngineError(c, err)
          }
          const validated = validateStartInput(
            c,
            workflow.inputs ?? [],
            body.values,
            files
          )
          if (validated instanceof Response) return validated
          const linked = resolveStartWorkItem(
            c,
            engine,
            body.workItemId,
            validated.itemKey
          )
          if (linked instanceof Response) return linked
          const dup = duplicateInputResponse(
            c,
            engine,
            workflowId,
            linked.itemKey,
            body.confirmDuplicate
          )
          if (dup) return dup
          try {
            const handle = await engine.startRun({
              workflowDir: dir,
              trustGrant: body.trustGrant,
              values: validated.values,
              files: validated.files,
              workItemId: linked.workItemId,
            })
            const resBody: StartRunResponse = {
              runId: handle.runId,
              status: handle.status,
            }
            return c.json(startRunResponseSchema.parse(resBody), 200)
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
    .post("/runs/:runId/rerun", zValidator("param", runParam), async (c) => {
      const { runId } = c.req.valid("param")
      const parsed = await parseStartRequest(c)
      if (parsed instanceof Response) return parsed
      const { body, files } = parsed

      return withIdempotency(c, idempotency, body.requestId, async () => {
        const state = engine.fold(runId)
        if (!state || state.deleted) {
          return errorJson(c, 404, "not_found", "run not found")
        }
        if (state.status === "running" || state.status === "queued") {
          return errorJson(c, 409, "conflict", "run is still live")
        }
        const dir = workflowDir(engine.home, state.workflowId)
        if (state.nodeGraph) {
          // A node run starts again from the current workflow.yaml (BL-102).
          return startNodeRoute(c, engine, dir, state.workflowId, body, files, {
            runId,
            workItemId: state.workItemId,
          })
        }
        let workflow
        try {
          workflow = engine.loadWorkflow(dir)
        } catch (err) {
          return mapEngineError(c, err)
        }
        const validated = validateStartInput(
            c,
            workflow.inputs ?? [],
            body.values,
            files
          )
        if (validated instanceof Response) return validated
        // Keep the original workItemId even if the item was trashed (BL-039).
        const workItemId = state.workItemId
        const itemKey =
          workItemId !== undefined
            ? workItemItemKey(workItemId)
            : validated.itemKey
        const dup = duplicateInputResponse(
          c,
          engine,
          state.workflowId,
          itemKey,
          body.confirmDuplicate
        )
        if (dup) return dup
        try {
          const handle = await engine.startRun({
            workflowDir: dir,
            trustGrant: body.trustGrant,
            values: validated.values,
            files: validated.files,
            pinFromRunId: runId,
            refreshPins: body.refreshPins,
            workItemId,
          })
          const resBody: StartRunResponse = {
            runId: handle.runId,
            status: handle.status,
          }
          return c.json(startRunResponseSchema.parse(resBody), 200)
        } catch (err) {
          if (isTrustRequired(err)) return trustRequired(c, engine, dir)
          return mapEngineError(c, err)
        }
      })
    })
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
