import {
  preflightResponseSchema,
  trustRequiredErrorSchema,
  type PreflightResponse,
  type TrustGrant,
} from "@workspace/shared"
import { api } from "@/lib/api"
import {
  rerunRun,
  startRun,
  type StartRunOptions,
  type StartRunResult,
  type ActionResult,
} from "@/lib/run-actions"

export type TrustStartPlan =
  | { kind: "start"; grant?: TrustGrant }
  | { kind: "dialog"; preflight: PreflightResponse }

/** Decide whether to start immediately or open the trust dialog. */
export function planTrustStart(preflight: PreflightResponse): TrustStartPlan {
  if (!preflight.needsAgentCli) return { kind: "start" }
  if (preflight.trust === "always") {
    const hasWarn = preflight.checks.some((c) => c.status === "warn")
    if (!hasWarn) return { kind: "start" }
    return { kind: "dialog", preflight }
  }
  return { kind: "dialog", preflight }
}

export async function fetchPreflight(
  workflowId: string
): Promise<ActionResult<PreflightResponse>> {
  const res = await api.workflows[":workflowId"].runs.preflight.$post({
    param: { workflowId },
  })
  if (!res.ok) {
    return { ok: false, error: `Preflight failed (${res.status})` }
  }
  return {
    ok: true,
    data: preflightResponseSchema.parse(await res.json()),
  }
}

export async function startRunWithGrant(
  workflowId: string,
  options: StartRunOptions = {}
): Promise<StartRunResult> {
  return startRun(workflowId, options)
}

export async function rerunWithGrant(
  runId: string,
  options: StartRunOptions = {}
): Promise<StartRunResult> {
  return rerunRun(runId, options)
}

export function parseTrustRequired(body: unknown): PreflightResponse | null {
  const parsed = trustRequiredErrorSchema.safeParse(body)
  if (!parsed.success) return null
  return {
    trust: parsed.data.trust,
    checks: parsed.data.checks,
    needsAgentCli: true,
  }
}

export type { StartRunOptions, StartRunResult }
