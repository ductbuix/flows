import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { engineError } from "@workspace/core"
import {
  applyInputDefaults,
  buildManualValuesSchema,
  parseNodeWorkflowYaml,
  type Workflow,
  type WorkflowInputDecl,
} from "@workspace/contracts"
import {
  readWorkItem,
  workflowDir,
  workItemItemKey,
  type Engine,
} from "@workspace/engine"
import type { CoreRunHost } from "./core-run-host.ts"

export type FcpStartArgs = {
  workflowId: string
  values?: Record<string, string>
  workItemId?: string
  refreshPins?: boolean
  only?: string
  from?: string
  baseRunId?: string
  rerunOf?: { runId: string; workItemId?: string }
}

/** Starts a node run for FCP; returns `{ runId }` immediately. */
export async function startRunForFcp(
  engine: Engine,
  args: FcpStartArgs,
  coreRuns?: CoreRunHost
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
  const workItemId = resolveWorkItem(
    engine,
    args.rerunOf ? args.rerunOf.workItemId : args.workItemId
  )
  const withInputs = !keepInputs && decls.length > 0
  try {
    const runId = randomUUID()
    const pinFromRunId = args.rerunOf?.runId ?? base
    const pins = await engine.pinNodeRun({
      graph,
      runId,
      workItemId,
      ...(pinFromRunId !== undefined ? { pinFromRunId } : {}),
      refreshPins: args.refreshPins,
    })
    const inputText =
      keepInputs || decls.length > 0 ? undefined : args.values?.text
    const inputs = withInputs ? { decls, values, files: [] } : undefined

    // Core path for trigger+command (BL-194); other kinds / queue → engine.
    if (coreRuns && !partial && coreRuns.canHandle(graph)) {
      const core = await coreRuns.tryStart({
        graph,
        runId,
        pins,
        inputText,
        inputs,
        workItemId,
      })
      if (core) return core
    }

    const handle = engine.startNodeRun({
      graph,
      runId,
      pins,
      ...(partial ? { partial } : {}),
      inputText,
      ...(inputs ? { inputs } : {}),
      workItemId,
    })
    void handle.wait().catch(() => undefined)
    return { runId: handle.runId }
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

function resolveWorkItem(
  engine: Engine,
  workItemId: string | undefined
): string | undefined {
  if (workItemId === undefined) return undefined
  if (!readWorkItem(engine.home, workItemId)) {
    throw engineError("invalid_params", `unknown_work_item: ${workItemId}`)
  }
  void workItemItemKey(workItemId)
  return workItemId
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
