import { zValidator } from "@hono/zod-validator"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  getCliAdapter,
  listCliModels,
  workflowDir,
  type Engine,
  type CliKind,
} from "@workspace/engine"
import {
  cliModelCatalogSchema,
  cliStatusSchema,
  parseNodeWorkflowYaml,
  preflightResponseSchema,
  putTrustBodySchema,
  trustStatusSchema,
  type CliModelCatalog,
  type CliStatus,
  type PreflightResponse,
  type TrustStatus,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import { errorJson } from "./control-helpers.ts"
import { nodesEnabled } from "./node-workflow-files.ts"

const workflowParam = z.object({ workflowId: z.string().min(1) })
const cliParam = z.object({ cli: z.enum(["claude", "cursor"]) })
const CLI_KINDS: CliKind[] = ["claude", "cursor"]

const MODEL_CACHE_MS = 60_000
const modelCache = new Map<CliKind, { at: number; catalog: CliModelCatalog }>()

/** GET/PUT /trust, GET /cli-status, GET /cli/:cli/models, preflight. */
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
    .get("/cli/:cli/models", zValidator("param", cliParam), async (c) => {
      const { cli } = c.req.valid("param")
      const cached = modelCache.get(cli)
      const now = Date.now()
      if (cached && now - cached.at < MODEL_CACHE_MS) {
        return c.json(cliModelCatalogSchema.parse(cached.catalog), 200)
      }
      const catalog = await listCliModels(cli)
      modelCache.set(cli, { at: now, catalog })
      return c.json(cliModelCatalogSchema.parse(catalog), 200)
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
        // Node workflows have no tasks to check; the CLIs are those of the
        // Agent nodes. The node start route does not gate on trust yet.
        if (nodesEnabled()) {
          const parsed = parseNodeWorkflowYaml(
            readFileSync(join(dir, "workflow.yaml"), "utf8")
          )
          const clis = [
            ...new Set(
              (parsed.workflow?.nodes ?? []).flatMap((n) =>
                n.kind === "agent" ? [n.cli] : []
              )
            ),
          ].sort()
          const body: PreflightResponse = {
            trust: engine.trustDecision(),
            checks: [],
            needsAgentCli: clis.length > 0,
            clis,
          }
          return c.json(preflightResponseSchema.parse(body), 200)
        }
        try {
          const result = await engine.preflight({ workflowDir: dir })
          const body: PreflightResponse = {
            trust: result.trust,
            checks: result.checks,
            needsAgentCli: result.needsAgentCli,
            clis: result.clis,
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
