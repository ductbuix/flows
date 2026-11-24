import { join } from "node:path"
import { createAcpRuntime } from "@workspace/agent-acp"
import { createNodeDocumentStore } from "@workspace/adapters-node"
import type { Workflow } from "@workspace/contracts"
import {
  createAcpAsks,
  createNodeEffectRunner,
  latestStep,
  RunActor,
  type AcpAsks,
  type AcpInboxAnswerInput,
  type PartialRun,
} from "@workspace/core"
import {
  getProcessRunner,
  recordUnpublishedLocalEffects,
  runDir,
  workflowDir,
  type Engine,
  type ManualItem,
  type MaterializeResourcesResult,
} from "@workspace/adapters-node"
import { createEnginePublishPort } from "./core-run-publish.ts"
import { resumeCoreRuns } from "./core-run-resume.ts"
import { createCoreRunSession } from "./core-run-session.ts"
import { retryCoreStep, startCoreRun } from "./core-run-start.ts"

export type CoreStartArgs = {
  graph: Workflow
  runId: string
  pins?: MaterializeResourcesResult
  inputText?: string
  inputs?: ManualItem
  workItemId?: string
  partial?: PartialRun
}

export type CoreApprovalAnswer = {
  runId: string
  nodeId: string
  decision: "approved" | "rejected"
}

export type CoreRunHost = {
  tryStart(args: CoreStartArgs): Promise<{ runId: string }>
  isLive(runId: string): boolean
  answerApproval(args: CoreApprovalAnswer): Promise<boolean>
  answerAcpAsk(input: AcpInboxAnswerInput): boolean
  cancel(runId: string): boolean | Promise<boolean>
  retryStep(runId: string, nodeId: string): Promise<boolean>
  resumeAll(): Promise<void>
  /** Drop live actors without cancel events (crash simulation). */
  abandon(): void
  dispose(): void
}

/** Core RunActor + Scheduler over the shared engine EventLog (BL-194..196). */
export function createCoreRunHost(engine: Engine): CoreRunHost {
  const docs = createNodeDocumentStore({ root: engine.home })
  const processRunner = getProcessRunner()
  const agentRuntime = createAcpRuntime({ processRunner })
  const session = createCoreRunSession()
  const { live, aborts, scheduler } = session

  const relRunDir = (workflowId: string, runId: string) =>
    `/workflows/${workflowId}/runs/${runId}`
  const absOf = (storePath: string) =>
    join(engine.home, storePath.replace(/^\//, ""))

  const acpAsks: AcpAsks = createAcpAsks({
    append: (event) => engine.appendLibraryEvent(event),
  })
  const runEffect = createNodeEffectRunner({
    docs,
    process: processRunner,
    processEnv: process.env,
    agentRuntime,
    acpAsks: acpAsks.gates,
    publish: createEnginePublishPort({
      home: engine.home,
      absoluteRunDir: absOf,
    }),
    runDirOf: (state) => relRunDir(state.workflowId, state.runId),
    workflowDirOf: (state) => `/workflows/${state.workflowId}`,
    absolutePathOf: absOf,
    agentCwdOf: (state, nodeId, pass) =>
      absOf(
        `${relRunDir(state.workflowId, state.runId)}/nodes/${nodeId}/pass-${pass}`
      ),
    signalOf: (state) => aborts.get(state.runId)?.signal,
    postNotice: (n) => engine.postNotice(n),
  })

  const makeActor = (runId: string) =>
    new RunActor(runId, { events: engine.eventStore(), runEffect })

  async function activate(runId: string): Promise<void> {
    const entry = live.get(runId)
    if (!entry || entry.actor.getState()?.status !== "queued") return
    const at = new Date().toISOString()
    await entry.actor.push({ kind: "activate", at })
    await entry.actor.push({ kind: "wake", at })
    session.endIfTerminal(runId, entry.actor)
  }
  session.onActivated = (runId) => {
    void activate(runId).catch(() => session.endLive(runId))
  }

  const recordLocal = async (runId: string, workflowId: string) => {
    try {
      await recordUnpublishedLocalEffects({
        home: engine.home,
        runRoot: runDir(workflowDir(engine.home, workflowId), runId),
        runId,
        append: (event) => engine.appendLibraryEvent(event),
      })
    } catch {
      /* diff failures must not block run end */
    }
  }
  const prevEndLive = session.endLive.bind(session)
  session.endLive = (runId) => {
    const entry = live.get(runId)
    const workflowId = entry?.workflowId
    prevEndLive(runId)
    if (workflowId) void recordLocal(runId, workflowId)
  }

  return {
    isLive: (runId) => live.has(runId),
    tryStart: (args) => startCoreRun(engine, session, makeActor, args),
    retryStep: (runId, nodeId) =>
      retryCoreStep(engine, session, makeActor, runId, nodeId),
    resumeAll: () => resumeCoreRuns({ engine, session, makeActor, activate }),

    async answerApproval(args) {
      const entry = live.get(args.runId)
      if (!entry?.actor.getState()) return false
      const step = latestStep(entry.actor.getState()!.steps, args.nodeId)
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
      session.endIfTerminal(args.runId, entry.actor)
      return true
    },

    answerAcpAsk(input) {
      if (!live.has(input.runId)) return false
      return acpAsks.answer(input)
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
        live.delete(runId)
        aborts.delete(runId)
        for (const r of scheduler.activeRuns()) {
          if (live.get(r.runId)?.actor.getState()?.status === "queued") {
            void activate(r.runId)
          }
        }
      }
      return true
    },

    abandon() {
      acpAsks.cancelAll()
      for (const runId of [...live.keys()]) {
        aborts.get(runId)?.abort()
        live.delete(runId)
        aborts.delete(runId)
      }
    },

    dispose() {
      acpAsks.cancelAll()
      for (const runId of [...live.keys()]) {
        aborts.get(runId)?.abort()
        void this.cancel(runId)
      }
    },
  }
}
