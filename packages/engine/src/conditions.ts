import type { Condition } from "@workspace/shared"
import { evaluateExpr } from "./conditions-expr.ts"
import { judgeCacheKey, runAgentJudge } from "./judge.ts"

export type ConditionContext = {
  /** Latest exit code of the subject attempt/task, if any. */
  exitCode?: number
  /** Attempt root (contains `out/`). Required for expr and agent. */
  attemptRoot?: string
  /** Workflow root; required to resolve agent instructions. */
  workflowRoot?: string
  /** For task-level `when` with exit: latest exit per need task id. */
  needExitCodes?: Record<string, number | undefined>
  /** Per-run cache of in-flight / finished agent judges. */
  judgeCache?: Map<string, Promise<boolean>>
}

export { evaluateExpr } from "./conditions-expr.ts"

/** True when this node or a descendant needs an agent CLI. */
export function conditionIsSlow(condition: Condition): boolean {
  if ("agent" in condition) return true
  if ("all" in condition) return condition.all.some(conditionIsSlow)
  if ("any" in condition) return condition.any.some(conditionIsSlow)
  return false
}

/** Evaluate exit / expr / agent / all / any (DES-004). */
export async function evaluateCondition(
  condition: Condition,
  ctx: ConditionContext
): Promise<boolean> {
  if ("exit" in condition) return matchExit(condition.exit, ctx)
  if ("expr" in condition) return evaluateExpr(condition.expr, ctx.attemptRoot)
  if ("agent" in condition) return evaluateAgent(condition.agent, ctx)
  if ("all" in condition) return evalAll(condition.all, ctx)
  return evalAny(condition.any, ctx)
}

async function evalAll(
  items: Condition[],
  ctx: ConditionContext
): Promise<boolean> {
  for (const c of cheapFirst(items)) {
    if (!(await evaluateCondition(c, ctx))) return false
  }
  return true
}

async function evalAny(
  items: Condition[],
  ctx: ConditionContext
): Promise<boolean> {
  for (const c of cheapFirst(items)) {
    if (await evaluateCondition(c, ctx)) return true
  }
  return false
}

/** Cheap kinds before agent (and before groups that contain agent). */
function cheapFirst(items: Condition[]): Condition[] {
  const cheap: Condition[] = []
  const slow: Condition[] = []
  for (const c of items) {
    if (conditionIsSlow(c)) slow.push(c)
    else cheap.push(c)
  }
  return [...cheap, ...slow]
}

function matchExit(
  expected: number | number[],
  ctx: ConditionContext
): boolean {
  const set = new Set(Array.isArray(expected) ? expected : [expected])
  if (ctx.needExitCodes) {
    const codes = Object.values(ctx.needExitCodes)
    if (codes.length === 0) return false
    return codes.every((code) => code !== undefined && set.has(code))
  }
  return ctx.exitCode !== undefined && set.has(ctx.exitCode)
}

async function evaluateAgent(
  agent: { cli: "claude" | "cursor"; instructions: string },
  ctx: ConditionContext
): Promise<boolean> {
  if (!ctx.attemptRoot || !ctx.workflowRoot) return false
  const key = judgeCacheKey(agent, ctx.workflowRoot, ctx.attemptRoot)
  const cache = ctx.judgeCache
  if (cache?.has(key)) return cache.get(key)!
  const pending = runAgentJudge({
    judge: agent,
    workflowRoot: ctx.workflowRoot,
    attemptRoot: ctx.attemptRoot,
  })
  cache?.set(key, pending)
  return pending
}
