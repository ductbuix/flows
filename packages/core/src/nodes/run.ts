import type { EffectResult, RunEffect, RunState } from "../runs/model.ts"
import { createCoreNodeRegistry } from "./builtins.ts"
import { runCommandEffect } from "./command-effect.ts"
import type { NodeEffectRunnerDeps } from "./run-deps.ts"
import { runKindEffect } from "./run-kind-effect.ts"
import { runWriteOutputEffect } from "./write-output-effect.ts"

export { CORE_NODE_KINDS, createCoreNodeRegistry } from "./builtins.ts"
export { collectExecute } from "./collect-execute.ts"
export type { NodeEffectRunnerDeps, NoticePost } from "./run-deps.ts"

/**
 * RunEffect handler that drives NodeKind.execute for registered kinds;
 * command uses ProcessRunner; folder output copies via DocumentStore.
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
      return runWriteOutputEffect(effect, state, {
        docs: deps.docs,
        runDirOf: deps.runDirOf,
      })
    }

    if (effect.kind === "launch_step") {
      const kindResult = await runKindEffect(effect, state, {
        ...deps,
        registry,
        now,
      })
      if (kindResult) return kindResult

      const node = state.graph.nodes.find((n) => n.id === effect.nodeId)
      if (node?.kind === "command" && deps.process && deps.workflowDirOf) {
        return runCommandEffect(effect, state, {
          docs: deps.docs,
          process: deps.process,
          runDirOf: deps.runDirOf,
          workflowDirOf: deps.workflowDirOf,
          absolutePathOf: deps.absolutePathOf,
          baseEnv: deps.processEnv,
          signalOf: deps.signalOf,
          now,
        })
      }
      // Unknown kinds: shell owns the spawn; stub settles.
      return { ok: true, outputs: [`out/${effect.nodeId}`] }
    }

    return { ok: false, reason: "exit" }
  }
}
