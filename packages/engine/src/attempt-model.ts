import {
  resolveModelEffort,
  type AgentSpec,
  type Effort,
  type ModelSource,
  type Workflow,
} from "@workspace/contracts"
import { getCliAdapter } from "./cli-adapters.ts"

export type AttemptModelFields = {
  model?: string
  effort?: Effort
  modelSource: ModelSource
}

/**
 * Fields for attempt_launched: resolved yaml pair, or CLI defaults when
 * flags were omitted (DES-023).
 */
export function resolveAttemptModelFields(
  task: AgentSpec,
  graph: Pick<Workflow, "agent">
): AttemptModelFields {
  const resolved = resolveModelEffort({
    task,
    workflowAgent: graph.agent,
  })
  if (resolved.model !== undefined || resolved.effort !== undefined) {
    return {
      ...(resolved.model !== undefined ? { model: resolved.model } : {}),
      ...(resolved.effort !== undefined ? { effort: resolved.effort } : {}),
      modelSource: resolved.modelSource,
    }
  }
  const defaults = getCliAdapter(task.cli).readDefaults()
  return {
    ...(defaults.model !== undefined ? { model: defaults.model } : {}),
    ...(defaults.effort !== undefined ? { effort: defaults.effort } : {}),
    modelSource: "cli",
  }
}
