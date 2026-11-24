import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cardPath, engineError } from "@workspace/core"
import {
  applyInputDefaults,
  buildManualValuesSchema,
  parseNodeWorkflowYaml,
  type Workflow,
  type WorkflowInputDecl,
} from "@workspace/contracts"
import { workflowDir, type Host } from "@workspace/adapters-node"
import type { CoreRunHost } from "./core-run-host.ts"

export type FcpStartArgs = {
  workflowId: string
  values?: Record<string, string>
  cardId?: string
  refreshPins?: boolean
  only?: string
  from?: string
  baseRunId?: string
  rerunOf?: { runId: string; cardId?: string }
}

/** Starts a node run for FCP; returns `{ runId }` immediately. */
export async function startRunForFcp(
  engine: Host,
  args: FcpStartArgs,
  coreRuns: CoreRunHost
): Promise<{ runId: string }> {
  const dir = workflowDir(engine.home, args.workflowId)
  if (!existsSync(join(dir, "workflow.yaml"))) {
    throw engineError("not_found", `Workflow not found: ${args.workflowId}`)
  }
  const parsed = parseNodeWorkflowYaml(
    readFileSync(join(dir, "workflow.yaml"), "utf8")
  )
  if (!parsed.workflow || parsed.errors.length > 0) {
    throw engineError(
      "invalid_params",
      parsed.errors[0]?.message ?? "invalid workflow"
    )
  }
  const graph = parsed.workflow
  const partial =
    args.only !== undefined || args.from !== undefined
      ? { only: args.only, from: args.from, baseRunId: args.baseRunId }
      : undefined
  const base = partial
    ? engine.latestNodeRunId(args.workflowId, partial.baseRunId)
    : undefined
  const decls = triggerInputs(graph)
  const keepInputs = base !== undefined
  const values = keepInputs ? {} : validateValues(decls, args.values ?? {})
  const cardId = resolveCard(
    engine,
    args.rerunOf ? args.rerunOf.cardId : args.cardId
  )
  const withInputs = !keepInputs && decls.length > 0
  try {
    const runId = randomUUID()
    const pinFromRunId = args.rerunOf?.runId ?? base
    const pins = await engine.pinNodeRun({
      graph,
      runId,
      cardId,
      ...(pinFromRunId !== undefined ? { pinFromRunId } : {}),
      refreshPins: args.refreshPins,
    })
    const inputText =
      keepInputs || decls.length > 0 ? undefined : args.values?.text
    const inputs = withInputs ? { decls, values, files: [] } : undefined

    const corePartial = partial
      ? {
          only: partial.only,
          from: partial.from,
          bases: partialBases(
            engine,
            args.workflowId,
            runId,
            partial.baseRunId
          ),
        }
      : undefined
    return coreRuns.tryStart({
      graph,
      runId,
      pins,
      inputText,
      inputs,
      cardId,
      ...(corePartial ? { partial: corePartial } : {}),
    })
  } catch (err) {
    throw mapStartError(err)
  }
}

function triggerInputs(graph: Workflow): WorkflowInputDecl[] {
  const trigger = graph.nodes.find((n) => n.kind === "trigger")
  const inputs = trigger && "inputs" in trigger ? trigger.inputs : undefined
  return (inputs as WorkflowInputDecl[] | undefined) ?? []
}

function validateValues(
  decls: WorkflowInputDecl[],
  rawValues: Record<string, string>
): Record<string, string> {
  if (decls.length === 0) return rawValues
  const schema = buildManualValuesSchema(decls)
  const textResult = schema.safeParse(rawValues)
  if (!textResult.success) {
    throw engineError("invalid_params", "invalid_input", {
      fields: Object.fromEntries(
        textResult.error.issues.map((issue) => [
          String(issue.path[0] ?? "values"),
          issue.message,
        ])
      ),
    })
  }
  return applyInputDefaults(decls, rawValues)
}

function resolveCard(
  engine: Host,
  cardId: string | undefined
): string | undefined {
  if (cardId === undefined) return undefined
  if (!existsSync(join(engine.home, cardPath(cardId)))) {
    throw engineError("invalid_params", `unknown_card: ${cardId}`)
  }
  return cardId
}

/** Earlier runs for a partial seed: baseRunId first, then the rest (BL-102). */
function partialBases(
  engine: Host,
  workflowId: string,
  runId: string,
  baseRunId?: string
): string[] {
  const earlier = engine
    .listRunsForWorkflow(workflowId)
    .filter((r) => r.graph && !r.deleted && r.runId !== runId)
    .map((r) => r.runId)
  if (baseRunId !== undefined && !earlier.includes(baseRunId)) {
    throw engineError("invalid_params", `unknown base run ${baseRunId}`)
  }
  return [
    ...(baseRunId !== undefined ? [baseRunId] : []),
    ...earlier.filter((id) => id !== baseRunId),
  ]
}

function mapStartError(err: unknown): never {
  const message = err instanceof Error ? err.message : "request failed"
  if (/unknown|not found/i.test(message)) {
    throw engineError("not_found", message)
  }
  if (/conflict|live|still/i.test(message)) {
    throw engineError("conflict", message)
  }
  throw engineError("invalid_params", message)
}
