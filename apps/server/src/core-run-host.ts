import { join } from "node:path"
import { createAcpRuntime } from "@workspace/agent-acp"
import {
  createNodeDocumentStore,
  createNodeProcessRunner,
} from "@workspace/adapters-node"
import type { Workflow } from "@workspace/contracts"
import {
  createNodeEffectRunner,
  createScheduler,
  latestStep,
  RunActor,
  type Scheduler,
} from "@workspace/core"
import {
  type Engine,
  type ManualItem,
  type MaterializeResourcesResult,
} from "@workspace/engine"
import { isCoreRunEligible } from "./core-run-eligible.ts"
import { prepareCoreRunDir } from "./core-run-prepare.ts"

export type CoreStartArgs = {
  graph: Workflow
  runId: string
  pins?: MaterializeResourcesResult
  inputText?: string
  inputs?: ManualItem
  workItemId?: string
}

export type CoreApprovalAnswer = {
  runId: string
  nodeId: string
  decision: "approved" | "rejected"
}

export type CoreRunHost = {
  /** Graphs this host can drive (BL-194; widen in BL-195). */
  canHandle(graph: Workflow): boolean
  /**
   * Start on core when eligible and a scheduler slot is free.
   * Returns null when the caller should use the engine path instead.
   */
  tryStart(args: CoreStartArgs): Promise<{ runId: string } | null>
  /** True when this host owns a live actor for the run. */
  isLive(runId: string): boolean
  /**
   * Route an inbox approval answer to the live actor.
   * Returns false when this host is not driving the run.
   */
  answerApproval(args: CoreApprovalAnswer): Promise<boolean>
  /** Cancel a live core run; false if this host is not driving it. */
  cancel(runId: string): boolean | Promise<boolean>
  dispose(): void
}

type LiveRun = {
  actor: RunActor
  workflowId: string
}

/**
 * Composes core RunActor + Scheduler behind adapters-node ports (BL-194).
 * Shares the engine EventLog so fold / run/list / UpdateBus stay one path.
 */
export function createCoreRunHost(engine: Engine): CoreRunHost {
  const docs = createNodeDocumentStore({ root: engine.home })
  const processRunner = createNodeProcessRunner()
  const agentRuntime = createAcpRuntime({ processRunner })
  const scheduler: Scheduler = createScheduler({
    maxConcurrent: 32,
    maxConcurrentRuns: (workflowId) => caps.get(workflowId) ?? 1,
  })
  const caps = new Map<string, number>()
  const live = new Map<string, LiveRun>()
  const aborts = new Map<string, AbortController>()

  // Leading `/` matches createNodeDocumentStore list paths (root = home).
  const relRunDir = (workflowId: string, runId: string) =>
    `/workflows/${workflowId}/runs/${runId}`
  const relWorkflowDir = (workflowId: string) => `/workflows/${workflowId}`
  const absOf = (storePath: string) =>
    join(engine.home, storePath.replace(/^\//, ""))

  const runEffect = createNodeEffectRunner({
    docs,
    process: processRunner,
    processEnv: process.env,
    agentRuntime,
    runDirOf: (state) => relRunDir(state.workflowId, state.runId),
    workflowDirOf: (state) => relWorkflowDir(state.workflowId),
    absolutePathOf: absOf,
    agentCwdOf: (state, nodeId, pass) =>
      absOf(
        `${relRunDir(state.workflowId, state.runId)}/nodes/${nodeId}/pass-${pass}`
      ),
    signalOf: (state) => aborts.get(state.runId)?.signal,
    postNotice: (n) => engine.postNotice(n),
  })

  function endLive(runId: string): void {
    live.delete(runId)
    aborts.delete(runId)
    scheduler.endRun(runId)
  }

  function endIfTerminal(runId: string, actor: RunActor): void {
    const status = actor.getState()?.status
    if (
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      endLive(runId)
    }
  }

  return {
    canHandle: isCoreRunEligible,

    isLive(runId) {
      return live.has(runId)
    },

    async tryStart(args) {
      if (!isCoreRunEligible(args.graph)) return null
      caps.set(args.graph.id, args.graph.limits?.maxConcurrentRuns ?? 1)
      const at = new Date().toISOString()
      const slot = scheduler.admit(args.runId, args.graph.id, at)
      if (slot === "queued") {
        // Queue activation is BL-196; keep engine queue for now.
        scheduler.cancel(args.runId)
        return null
      }

      prepareCoreRunDir({
        home: engine.home,
        graph: args.graph,
        runId: args.runId,
        inputText: args.inputText,
        inputs: args.inputs,
        workItemId: args.workItemId,
      })

      const actor = new RunActor(args.runId, {
        events: engine.eventStore(),
        runEffect,
      })
      aborts.set(args.runId, new AbortController())
      live.set(args.runId, { actor, workflowId: args.graph.id })

      const seed = args.pins?.pulledEvents
      void actor
        .push({
          kind: "start",
          at,
          runId: args.runId,
          graph: args.graph,
          workItemId: args.workItemId,
          ...(seed && seed.length > 0 ? { seed } : {}),
        })
        .then(() => {
          endIfTerminal(args.runId, actor)
        })
        .catch(() => {
          endLive(args.runId)
        })

      return { runId: args.runId }
    },

    async answerApproval(args) {
      const entry = live.get(args.runId)
      if (!entry) return false
      const state = entry.actor.getState()
      if (!state) return false
      const step = latestStep(state.steps, args.nodeId)
      if (!step || step.status !== "waiting") return false
      const at = new Date().toISOString()
      await entry.actor.push({
        kind: "answer",
        at,
        nodeId: args.nodeId,
        pass: step.pass,
        decision: args.decision,
      })
      await entry.actor.push({ kind: "wake", at })
      endIfTerminal(args.runId, entry.actor)
      return true
    },

    async cancel(runId) {
      const entry = live.get(runId)
      if (!entry) return false
      scheduler.cancel(runId)
      aborts.get(runId)?.abort()
      try {
        await entry.actor.push({
          kind: "cancel",
          at: new Date().toISOString(),
        })
      } finally {
        endLive(runId)
      }
      return true
    },

    dispose() {
      for (const runId of [...live.keys()]) {
        aborts.get(runId)?.abort()
        void this.cancel(runId)
      }
    },
  }
}
