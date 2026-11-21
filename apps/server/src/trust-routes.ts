import { zValidator } from "@hono/zod-validator"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  getCliAdapter,
  workflowDir,
  type Engine,
  type CliKind,
} from "@workspace/engine"
import {
  cliStatusSchema,
  preflightResponseSchema,
  putTrustBodySchema,
  trustStatusSchema,
  type CliStatus,
  type PreflightResponse,
  type TrustStatus,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import { errorJson } from "./control-helpers.ts"

const workflowParam = z.object({ workflowId: z.string().min(1) })
const CLI_KINDS: CliKind[] = ["claude", "cursor"]

/** GET/PUT /trust, GET /cli-status, POST .../runs/preflight (DES-019, 024). */
export function trustRoutes(engine: Engine) {
  return new Hono()
    .get("/trust", (c) => {
      const homeRealpath = engine.homeRealpath()
      const trust = engine.trustDecision()
      const body: TrustStatus = {
        trust,
        homeRealpath,
        alwaysTrusted: trust === "always",
      }
      return c.json(trustStatusSchema.parse(body), 200)
    })
    .put("/trust", zValidator("json", putTrustBodySchema), (c) => {
      const { grant } = c.req.valid("json")
      if (grant === "always") engine.setAlwaysTrust()
      else engine.revokeAlwaysTrust()
      const trust = engine.trustDecision()
      const body: TrustStatus = {
        trust,
        homeRealpath: engine.homeRealpath(),
        alwaysTrusted: trust === "always",
      }
      return c.json(trustStatusSchema.parse(body), 200)
    })
    .get("/cli-status", async (c) => {
      const clis = await Promise.all(
        CLI_KINDS.map(async (id) => {
          const version = await getCliAdapter(id).probeVersion()
          return { id, installed: Boolean(version), version }
        })
      )
      const body: CliStatus = { clis }
      return c.json(cliStatusSchema.parse(body), 200)
    })
    .post(
      "/workflows/:workflowId/runs/preflight",
      zValidator("param", workflowParam),
      async (c) => {
        const { workflowId } = c.req.valid("param")
        const dir = workflowDir(engine.home, workflowId)
        if (!existsSync(join(dir, "workflow.yaml"))) {
          return errorJson(c, 404, "not_found", "workflow not found")
        }
        try {
          const result = await engine.preflight({ workflowDir: dir })
          const body: PreflightResponse = {
            trust: result.trust,
            checks: result.checks,
            needsAgentCli: result.needsAgentCli,
          }
          return c.json(preflightResponseSchema.parse(body), 200)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "preflight failed"
          return errorJson(c, 400, "bad_request", message)
        }
      }
    )
}
