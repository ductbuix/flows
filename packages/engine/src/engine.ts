import { randomUUID } from "node:crypto"
import type { EngineEvent, Workflow } from "@workspace/shared"
import { prepareRunDirs } from "./dirs.ts"
import { EventLog } from "./event-log.ts"
import { foldEvents, type RunState } from "./fold.ts"
import { appDbPath, resolveAppHome } from "./paths.ts"
import { Scheduler } from "./scheduler.ts"
import { assertValidGraph, loadWorkflowFile } from "./workflow.ts"

export type CreateEngineOptions = {
  /** App home directory. Defaults to FLOWAPP_HOME or ~/.flowapp. */
  home?: string
}

export type StartRunOptions = {
  /** Absolute path to the workflow directory (contains workflow.yaml). */
  workflowDir: string
  /** Optional run id; random UUID if omitted. */
  runId?: string
}

export type RunHandle = {
  runId: string
  wait: () => Promise<RunState>
  state: () => RunState
}

export class Engine {
  readonly home: string
  private readonly log: EventLog
  private readonly schedulers = new Map<string, Scheduler>()

  constructor(options: CreateEngineOptions = {}) {
    this.home = resolveAppHome(options.home)
    this.log = new EventLog(appDbPath(this.home))
  }

  loadWorkflow(workflowDir: string): Workflow {
    const workflow = loadWorkflowFile(workflowDir)
    assertValidGraph(workflow)
    return workflow
  }

  events(runId: string): EngineEvent[] {
    return this.log.listByRun(runId).map((e) => e.event)
  }

  fold(runId: string): RunState | null {
    return foldEvents(this.events(runId))
  }

  /** Start a run from workflow.yaml under workflowDir. */
  startRun(options: StartRunOptions): RunHandle {
    const graph = this.loadWorkflow(options.workflowDir)
    const runId = options.runId ?? randomUUID()
    const runRoot = prepareRunDirs(options.workflowDir, runId, graph)

    this.log.append({
      type: "run_started",
      runId,
      workflowId: graph.id,
      graph,
      at: new Date().toISOString(),
    })

    const scheduler = new Scheduler({
      log: this.log,
      runId,
      workflowRoot: options.workflowDir,
      runRoot,
      graph,
    })
    this.schedulers.set(runId, scheduler)
    scheduler.requestTick()

    return {
      runId,
      wait: () => scheduler.wait(),
      state: () => scheduler.state(),
    }
  }

  close(): void {
    this.log.close()
  }
}

export function createEngine(options?: CreateEngineOptions): Engine {
  return new Engine(options)
}
