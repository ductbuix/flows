import { resolveAnswerValues } from "@workspace/contracts"
import type { EffectResult, RunEffect, RunState } from "../runs/model.ts"
import { latestStep } from "../runs/model.ts"
import { createStepContext, loadRunInputs, loadStepInputs } from "./context.ts"
import { kindKeyForNode, type NodeKindRegistry } from "./registry.ts"
import type { NodeEffectRunnerDeps, NoticePost } from "./run-deps.ts"
import { collectExecute } from "./collect-execute.ts"

/** Drive a registered NodeKind.execute for a launch_step effect. */
export async function runKindEffect(
  effect: Extract<RunEffect, { kind: "launch_step" }>,
  state: RunState,
  deps: NodeEffectRunnerDeps & {
    registry: NodeKindRegistry
    now: () => string
  }
): Promise<EffectResult | null> {
  const node = state.graph.nodes.find((n) => n.id === effect.nodeId)
  if (!node) return { ok: false, reason: "exit" }
  const key = kindKeyForNode(node)
  const kind = key ? deps.registry.get(key) : undefined
  if (!kind) return null

  const runDir = deps.runDirOf(state)
  const step = latestStep(state.steps, effect.nodeId)
  const fromIds = state.graph.edges
    .filter((e) => e.to === effect.nodeId)
    .map((e) => e.from)
    .filter((id) => latestStep(state.steps, id)?.status === "done")

  const inputs =
    kind.kind === "trigger"
      ? loadRunInputs(deps.docs, runDir)
      : loadStepInputs(
          deps.docs,
          runDir,
          fromIds,
          (id) => latestStep(state.steps, id)?.pass ?? 1
        )

  const parsed = kind.settings.safeParse({ ...node })
  if (!parsed.success) return { ok: false, reason: "exit" }

  const answers = resolveAnswerValues(
    state.graph.nodes,
    state.graph.edges,
    effect.nodeId,
    (id) => latestStep(state.steps, id)?.answer
  )

  const planReview =
    parsed.data &&
    typeof parsed.data === "object" &&
    "planReview" in parsed.data &&
    (parsed.data.planReview === "auto" || parsed.data.planReview === "ask")
      ? parsed.data.planReview
      : undefined

  const ctx = createStepContext({
    docs: deps.docs,
    runDir,
    runId: state.runId,
    nodeId: effect.nodeId,
    pass: effect.pass,
    settings: parsed.data,
    inputs,
    answers,
    decision: step?.decision,
    graph: { id: state.graph.id, name: state.graph.name },
    nodeName: node.name,
    agentRuntime: deps.agentRuntime,
    agentCwd: deps.agentCwdOf?.(state, effect.nodeId, effect.pass),
    acpAsks: deps.acpAsks,
    publish: deps.publish,
    ...(planReview !== undefined ? { planReview } : {}),
    signal: deps.signalOf?.(state),
  })

  const result = await collectExecute(kind.execute(ctx))
  if ("ok" in result && result.ok && result.notice) {
    postNotice(deps, state, effect, result.notice, deps.now)
    return { ok: true, outputs: result.outputs ?? [] }
  }
  return result
}

function postNotice(
  deps: { postNotice?: (n: NoticePost) => void },
  state: RunState,
  effect: { nodeId: string; pass: number },
  notice: { title: string; text: string; channel?: "app" | "system" },
  now: () => string
): void {
  deps.postNotice?.({
    key: `${state.runId}:${effect.nodeId}:${effect.pass}`,
    title: notice.title,
    text: notice.text,
    runId: state.runId,
    workflowId: state.workflowId,
    nodeId: effect.nodeId,
    at: now(),
    ...(notice.channel ? { channel: notice.channel } : {}),
  })
}
