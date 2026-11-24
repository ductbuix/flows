import type { EngineEvent, Workflow } from "@workspace/contracts"
import { workflowSchema } from "@workspace/contracts"
import { decide } from "./decide.ts"
import { fold } from "./fold.ts"
import type { EffectResult, RunEffect, RunState } from "./model.ts"

export const at = "2026-11-24T00:00:00.000Z"
export const later = "2026-11-24T00:00:10.000Z"

export function parse(
  nodes: object[],
  edges: object[],
  limits?: { loopPasses: number }
) {
  return workflowSchema.parse({
    id: "wf",
    ...(limits ? { limits } : {}),
    nodes: [{ id: "t", kind: "trigger", type: "manual" }, ...nodes],
    edges,
  }) as Workflow
}

function applyEffects(
  state: RunState,
  effects: RunEffect[],
  resultFor: (fx: RunEffect, state: RunState) => EffectResult
): RunState {
  let s = state
  for (const fx of effects) {
    const result = resultFor(fx, s)
    if (fx.kind === "launch_step") {
      const exitCode = "ok" in result && result.ok === false ? 1 : 0
      s = fold(s, {
        type: "attempt_started",
        runId: s.runId,
        at: later,
        taskId: fx.nodeId,
        nodeId: fx.nodeId,
        pass: fx.pass,
        attempt: fx.attempt,
      })!
      s = fold(s, {
        type: "attempt_finished",
        runId: s.runId,
        at: later,
        taskId: fx.nodeId,
        nodeId: fx.nodeId,
        pass: fx.pass,
        attempt: fx.attempt,
        exitCode,
      })!
    }
    const settled = decide(s, {
      kind: "effect_result",
      at: later,
      nodeId: fx.nodeId,
      pass: fx.pass,
      result,
      retryBackoffMs: 1,
    })
    for (const e of settled.events) s = fold(s, e)!
    if (settled.effects.length > 0) {
      s = applyEffects(s, settled.effects, resultFor)
    }
  }
  return s
}

/** Drive decide+fold until settled. */
export function runToEnd(
  graph: Workflow,
  opts: {
    only?: string
    seed?: EngineEvent[]
    result?: (fx: RunEffect, state: RunState) => EffectResult
    branchOf?: Record<string, string>
  } = {}
): RunState {
  const start = decide(null, {
    kind: "start",
    at,
    runId: "r1",
    graph,
    only: opts.only,
    seed: opts.seed,
  })
  let state: RunState | null = null
  for (const e of start.events) state = fold(state, e)
  if (!state) throw new Error("no state")

  const resultFor =
    opts.result ??
    ((fx: RunEffect, s: RunState): EffectResult => {
      if (fx.kind === "post_inbox") {
        return { waiting: true, question: fx.question }
      }
      const node = s.graph.nodes.find((n) => n.id === fx.nodeId)
      if (node?.kind === "approval") {
        return { waiting: true, question: node.question ?? "Approve?" }
      }
      const branch = opts.branchOf?.[fx.nodeId]
      if (node?.kind === "judge" && branch) {
        return { ok: true, outputs: [], branch }
      }
      return { ok: true, outputs: [`out/${fx.nodeId}`] }
    })

  for (let i = 0; i < 100; i++) {
    const out = decide(state, { kind: "wake", at: later, retryBackoffMs: 1 })
    for (const e of out.events) state = fold(state, e)!
    if (out.events.length === 0 && out.effects.length === 0) break
    state = applyEffects(state!, out.effects, resultFor)
  }
  return state!
}
