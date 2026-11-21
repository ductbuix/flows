import {
  isAgentTask,
  resolveModelEffort,
  type AgentJudge,
  type AgentTask,
  type CliModelCatalog,
  type Condition,
  type ResolvedModelEffort,
  type TrustCheck,
  type Workflow,
  type WorkflowAgent,
} from "@workspace/shared"
import { getCliAdapter, type CliKind } from "./cli-adapters.ts"

type ResolvedPair = {
  label: string
  cli: CliKind
  resolved: ResolvedModelEffort
}

/**
 * Warn-only model/effort checks: list each resolved pair, warn when the
 * model is unknown or the effort is not offered (DES-023).
 */
export async function checkModelEffort(
  workflow: Workflow
): Promise<TrustCheck[]> {
  const pairs = collectResolvedPairs(workflow)
  if (pairs.length === 0) return []

  const catalogs = await loadCatalogs(pairs.map((p) => p.cli))
  const checks: TrustCheck[] = [
    {
      id: "model_effort",
      status: "pass",
      message: formatResolvedPairs(pairs),
    },
  ]

  for (const pair of pairs) {
    const catalog = catalogs.get(pair.cli)
    if (!catalog) continue
    const warning = pairWarning(pair, catalog)
    if (warning) {
      checks.push({
        id: `model_effort_${slug(pair.label)}`,
        status: "warn",
        message: warning,
      })
    }
  }
  return checks
}

function collectResolvedPairs(workflow: Workflow): ResolvedPair[] {
  const pairs: ResolvedPair[] = []
  const agent = workflow.agent

  for (const task of workflow.tasks) {
    if (isAgentTask(task)) {
      pairs.push({
        label: `task ${task.id}`,
        cli: task.cli,
        resolved: resolveModelEffort({ task, workflowAgent: agent }),
      })
    }
    const parent = isAgentTask(task) ? task : undefined
    pushJudgePairs(pairs, task.when, `task ${task.id} when`, parent, agent)
    pushJudgePairs(
      pairs,
      task.repeat?.until,
      `task ${task.id} until`,
      parent,
      agent
    )
    for (const need of task.needs) {
      if (typeof need === "string" || !need.when) continue
      pushJudgePairs(
        pairs,
        need.when,
        `task ${task.id} need ${need.task}`,
        parent,
        agent
      )
    }
  }
  return pairs
}

function pushJudgePairs(
  pairs: ResolvedPair[],
  condition: Condition | boolean | undefined,
  labelPrefix: string,
  parentTask: AgentTask | undefined,
  workflowAgent: WorkflowAgent | undefined
): void {
  if (condition === undefined || typeof condition === "boolean") return
  for (const judge of collectAgentJudges(condition)) {
    pairs.push({
      label: `${labelPrefix} (${judge.cli})`,
      cli: judge.cli,
      resolved: resolveModelEffort({
        judge,
        judgeCli: judge.cli,
        task: parentTask,
        workflowAgent,
      }),
    })
  }
}

/** Collect agent judge leaves from a condition tree. */
export function collectAgentJudges(condition: Condition): AgentJudge[] {
  if ("agent" in condition) return [condition.agent]
  if ("all" in condition) return condition.all.flatMap(collectAgentJudges)
  if ("any" in condition) return condition.any.flatMap(collectAgentJudges)
  return []
}

async function loadCatalogs(
  clis: CliKind[]
): Promise<Map<CliKind, CliModelCatalog>> {
  const unique = [...new Set(clis)]
  const map = new Map<CliKind, CliModelCatalog>()
  await Promise.all(
    unique.map(async (cli) => {
      map.set(cli, await getCliAdapter(cli).listModels())
    })
  )
  return map
}

function formatResolvedPairs(pairs: ResolvedPair[]): string {
  return pairs
    .map((p) => {
      const model = p.resolved.model ?? "(cli default)"
      const effort = p.resolved.effort ?? "(cli default)"
      return `${p.label}: model=${model} effort=${effort} (${p.resolved.modelSource})`
    })
    .join("; ")
}

function pairWarning(
  pair: ResolvedPair,
  catalog: CliModelCatalog
): string | undefined {
  const { model, effort } = pair.resolved
  if (!model && !effort) return undefined
  if (catalog.error && model) {
    return `${pair.label}: could not list models (${catalog.error}); custom id ${model} may be invalid`
  }
  if (!model) return undefined

  const entry = catalog.models.find((m) => m.id === model)
  if (!entry) {
    // Custom / bracket ids are allowed; only warn when catalog loaded cleanly.
    if (catalog.models.length === 0) return undefined
    return `${pair.label}: model ${model} is not in the ${pair.cli} catalog`
  }
  if (effort && !entry.efforts.includes(effort)) {
    return `${pair.label}: effort ${effort} is not offered for model ${model}`
  }
  return undefined
}

function slug(label: string): string {
  return label.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")
}
