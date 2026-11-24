import type { DocumentStore } from "../ports/document-store.ts"
import type { EffectResult, RunEffect, RunState } from "../runs/model.ts"
import { latestStep } from "../runs/model.ts"
import { createStepContext, loadRunInputs, loadStepInputs } from "./context.ts"
import {
  createNodeKindRegistry,
  kindKeyForNode,
  type NodeKindRegistry,
} from "./registry.ts"
import { approvalKind } from "./kinds/approval.ts"
import { assetKind } from "./kinds/asset.ts"
import { llmKind } from "./kinds/llm.ts"
import { notifyKind } from "./kinds/notify.ts"
import { triggerKind } from "./kinds/trigger.ts"
import { isAskPending, type NodeKind, type StepEvent } from "./types.ts"

/** Built-in kinds ported in BL-134 / BL-135 / BL-142. */
export const CORE_NODE_KINDS: readonly NodeKind[] = [
  triggerKind,
  assetKind,
  llmKind,
  approvalKind,
  notifyKind,
]

export function createCoreNodeRegistry(
  extra: readonly NodeKind[] = []
): NodeKindRegistry {
  return createNodeKindRegistry([...CORE_NODE_KINDS, ...extra])
}

export type NoticePost = {
  key: string
  title: string
  text: string
  runId: string
  workflowId: string
  nodeId: string
  at: string
}

export type NodeEffectRunnerDeps = {
  docs: DocumentStore
  registry?: NodeKindRegistry
  /** Run folder under the store, e.g. `workflows/wf/runs/r1`. */
  runDirOf: (state: RunState) => string
  /** Optional notice sink for the `notify` effect. */
  postNotice?: (n: NoticePost) => void
  now?: () => string
  /** Absolute cwd resolver for agent sessions (llm). */
  agentCwdOf?: (state: RunState, nodeId: string, pass: number) => string
  agentRuntime?: import("../ports/agent-runtime.ts").AgentRuntime
}

/** Fold StepEvents from one execute() into an EffectResult. */
export async function collectExecute(
  events: AsyncIterable<StepEvent>
): Promise<EffectResult> {
  const outputs: string[] = []
  let notice: { title: string; text: string } | undefined
  let branch: string | undefined
  let answer: Record<string, unknown> | undefined
  try {
    for await (const ev of events) {
      if (ev.kind === "output_written") outputs.push(ev.path)
      if (ev.kind === "notify") notice = { title: ev.title, text: ev.text }
      if (ev.kind === "waiting") {
        return { waiting: true, question: ev.question }
      }
      if (ev.kind === "failed") {
        return {
          ok: false,
          reason: ev.reason,
          ...(ev.message ? { message: ev.message } : {}),
        }
      }
      if (ev.kind === "done") {
        if (ev.outputs) outputs.push(...ev.outputs)
        branch = ev.branch
        answer = ev.answer
      }
    }
  } catch (e) {
    if (isAskPending(e)) return { waiting: true, question: e.question }
    throw e
  }
  return {
    ok: true,
    outputs: [...new Set(outputs)],
    ...(branch ? { branch } : {}),
    ...(answer ? { answer } : {}),
    ...(notice ? { notice } : {}),
  }
}

/**
 * RunEffect handler that drives NodeKind.execute for trigger, approval
 * and notify; other effects stay as simple shell stubs.
 */
export function createNodeEffectRunner(
  deps: NodeEffectRunnerDeps
): (effect: RunEffect, state: RunState) => Promise<EffectResult> {
  const registry = deps.registry ?? createCoreNodeRegistry()
  const now = deps.now ?? (() => new Date().toISOString())

  return async (effect, state) => {
    if (effect.kind === "post_inbox") {
      return { waiting: true, question: effect.question }
    }
    if (effect.kind === "notify") {
      deps.postNotice?.({
        key: `${state.runId}:${effect.nodeId}:${effect.pass}`,
        title: effect.title,
        text: "",
        runId: state.runId,
        workflowId: state.workflowId,
        nodeId: effect.nodeId,
        at: now(),
      })
      return { ok: true, outputs: [] }
    }
    if (effect.kind === "write_output") {
      return { ok: true, outputs: [] }
    }

    const node = state.graph.nodes.find((n) => n.id === effect.nodeId)
    if (!node) return { ok: false, reason: "exit" }
    const key = kindKeyForNode(node)
    const kind = key ? registry.get(key) : undefined
    if (!kind) {
      // Process / unknown kinds: shell owns the spawn; stub settles.
      return { ok: true, outputs: [`out/${effect.nodeId}`] }
    }

    const runDir = deps.runDirOf(state)
    const step = latestStep(state.steps, effect.nodeId)
    const fromIds =
      effect.kind === "launch_step"
        ? state.graph.edges
            .filter((e) => e.to === effect.nodeId)
            .map((e) => e.from)
            .filter((id) => {
              const s = latestStep(state.steps, id)
              return s?.status === "done"
            })
        : []

    const inputs =
      kind.kind === "trigger"
        ? loadRunInputs(deps.docs, runDir)
        : loadStepInputs(
            deps.docs,
            runDir,
            fromIds,
            (id) => latestStep(state.steps, id)?.pass ?? 1
          )

    const parsed = kind.settings.safeParse({
      ...node,
      ...(node.kind === "output" ? { target: "notify" as const } : {}),
    })
    if (!parsed.success) return { ok: false, reason: "exit" }

    const ctx = createStepContext({
      docs: deps.docs,
      runDir,
      nodeId: effect.nodeId,
      pass: effect.pass,
      settings: parsed.data,
      inputs,
      decision: step?.decision,
      graph: { id: state.graph.id, name: state.graph.name },
      nodeName: node.name,
      agentRuntime: deps.agentRuntime,
      agentCwd: deps.agentCwdOf?.(state, effect.nodeId, effect.pass),
    })

    const result = await collectExecute(kind.execute(ctx))
    // Post here (like engine tick) so the notice keeps its text; the
    // notify effect union has no text field.
    if ("ok" in result && result.ok && result.notice) {
      deps.postNotice?.({
        key: `${state.runId}:${effect.nodeId}:${effect.pass}`,
        title: result.notice.title,
        text: result.notice.text,
        runId: state.runId,
        workflowId: state.workflowId,
        nodeId: effect.nodeId,
        at: now(),
      })
      return { ok: true, outputs: result.outputs ?? [] }
    }
    return result
  }
}
