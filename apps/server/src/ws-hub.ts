import type { UpdateBus } from "@workspace/core"
import type { Engine, StoredEvent } from "@workspace/engine"
import {
  engineEventSchema,
  wsClientMessageSchema,
  type WsServerMessage,
} from "@workspace/shared"
import type { WSContext, WSEvents } from "hono/ws"
import { buildRunDetail } from "./run-detail.ts"
import { type LogSub, logSubKey, startLogSubscription } from "./ws-log.ts"
import { WorkflowWatcher, type FileChange } from "./workflow-watch.ts"

type SocketState = {
  runs: Set<string>
  workflows: Set<string>
  logs: Map<string, LogSub>
}

export class WsHub {
  private readonly offEvent: () => void
  private readonly sockets = new Map<WSContext, SocketState>()
  private readonly runWatchers = new Map<string, Set<WSContext>>()
  private readonly workflowWatchers = new Map<string, Set<WSContext>>()
  readonly files: WorkflowWatcher

  constructor(
    private readonly engine: Engine,
    private readonly bus: UpdateBus
  ) {
    this.files = new WorkflowWatcher(engine, (change) =>
      this.broadcastFileChange(change)
    )
    this.offEvent = engine.onEvent((stored) => {
      const runId = stored.event.runId
      this.broadcastRunsChanged(runId)
      const sockets = this.runWatchers.get(runId)
      if (!sockets) return
      for (const ws of sockets) this.pushRunEvent(ws, stored)
    })
  }

  dispose(): void {
    this.offEvent()
    this.files.dispose()
    for (const state of this.sockets.values()) {
      for (const sub of state.logs.values()) clearInterval(sub.timer)
    }
    this.sockets.clear()
    this.runWatchers.clear()
    this.workflowWatchers.clear()
  }

  connection(): WSEvents {
    return {
      onOpen: (_evt, ws) => {
        this.sockets.set(ws, {
          runs: new Set(),
          workflows: new Set(),
          logs: new Map(),
        })
        this.send(ws, { type: "hello" })
      },
      onMessage: (evt, ws) => this.onClientMessage(ws, evt.data),
      onClose: (_evt, ws) => this.dropSocket(ws),
    }
  }

  private onClientMessage(ws: WSContext, raw: string | Buffer) {
    const text = typeof raw === "string" ? raw : raw.toString("utf8")
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      this.send(ws, { type: "error", message: "invalid JSON" })
      return
    }
    const parsed = wsClientMessageSchema.safeParse(json)
    if (!parsed.success) {
      this.send(ws, { type: "error", message: "invalid message" })
      return
    }
    const msg = parsed.data
    switch (msg.type) {
      case "subscribe_run":
        this.subscribeRun(ws, msg.runId, msg.afterSeq ?? 0)
        break
      case "unsubscribe_run":
        this.unsubscribeRun(ws, msg.runId)
        break
      case "subscribe_log":
        this.subscribeLog(ws, msg)
        break
      case "unsubscribe_log":
        this.unsubscribeLog(ws, msg.runId, msg.taskId, msg.attempt, msg.stream)
        break
      case "subscribe_workflow":
        this.subscribeWorkflow(ws, msg.workflowId)
        break
      case "unsubscribe_workflow":
        this.unsubscribeWorkflow(ws, msg.workflowId)
        break
    }
  }

  private subscribeWorkflow(ws: WSContext, workflowId: string) {
    const state = this.sockets.get(ws)
    if (!state) return
    state.workflows.add(workflowId)
    let set = this.workflowWatchers.get(workflowId)
    if (!set) {
      set = new Set()
      this.workflowWatchers.set(workflowId, set)
    }
    set.add(ws)
    this.files.watch(workflowId)
  }

  private unsubscribeWorkflow(ws: WSContext, workflowId: string) {
    const state = this.sockets.get(ws)
    if (!state) return
    state.workflows.delete(workflowId)
    const set = this.workflowWatchers.get(workflowId)
    set?.delete(ws)
    if (set && set.size === 0) {
      this.workflowWatchers.delete(workflowId)
      this.files.unwatch(workflowId)
    }
  }

  private broadcastFileChange(change: FileChange) {
    const sockets = this.workflowWatchers.get(change.workflowId)
    if (!sockets) return
    const message: WsServerMessage = {
      type: "file_changed",
      workflowId: change.workflowId,
      path: change.path,
      hash: change.hash,
      content: change.content,
    }
    for (const ws of sockets) this.send(ws, message)
  }

  private broadcastRunsChanged(runId: string) {
    const summary = this.engine.getRunSummary(runId)
    const message: WsServerMessage = {
      type: "runs_changed",
      runId,
      summary,
    }
    for (const ws of this.sockets.keys()) this.send(ws, message)
    this.bus.publish("run/update", {
      kind: "run_changed",
      runId,
      summary,
    })
  }

  private subscribeRun(ws: WSContext, runId: string, afterSeq: number) {
    if (!buildRunDetail(this.engine, runId)) {
      this.send(ws, { type: "error", message: `unknown run ${runId}` })
      return
    }
    const state = this.sockets.get(ws)
    if (!state) return
    state.runs.add(runId)
    let watchers = this.runWatchers.get(runId)
    if (!watchers) {
      watchers = new Set()
      this.runWatchers.set(runId, watchers)
    }
    watchers.add(ws)

    for (const stored of this.engine.eventsWithSeq(runId)) {
      if (stored.seq > afterSeq) {
        this.send(ws, {
          type: "engine_event",
          seq: stored.seq,
          event: stored.event,
        })
      }
    }
    this.sendRunSnapshot(ws, runId)
  }

  private unsubscribeRun(ws: WSContext, runId: string) {
    const state = this.sockets.get(ws)
    if (!state) return
    state.runs.delete(runId)
    this.runWatchers.get(runId)?.delete(ws)
  }

  private subscribeLog(
    ws: WSContext,
    msg: Extract<
      import("@workspace/shared").WsClientMessage,
      { type: "subscribe_log" }
    >
  ) {
    const state = this.sockets.get(ws)
    if (!state) return
    this.unsubscribeLog(ws, msg.runId, msg.taskId, msg.attempt, msg.stream)

    const sub = startLogSubscription(this.engine, (data) => ws.send(data), {
      runId: msg.runId,
      taskId: msg.taskId,
      attempt: msg.attempt,
      stream: msg.stream,
      offset: msg.offset ?? 0,
    })
    if (!sub) {
      this.send(ws, { type: "error", message: "attempt not found" })
      return
    }
    state.logs.set(sub.key, sub)
  }

  private unsubscribeLog(
    ws: WSContext,
    runId: string,
    taskId: string,
    attempt: number,
    stream: "stdout" | "stderr"
  ) {
    const key = logSubKey(runId, taskId, attempt, stream)
    const state = this.sockets.get(ws)
    if (!state) return
    const sub = state.logs.get(key)
    if (!sub) return
    clearInterval(sub.timer)
    state.logs.delete(key)
  }

  private pushRunEvent(ws: WSContext, stored: StoredEvent) {
    const event = engineEventSchema.parse(stored.event)
    this.send(ws, { type: "engine_event", seq: stored.seq, event })
    this.sendRunSnapshot(ws, event.runId)
  }

  private sendRunSnapshot(ws: WSContext, runId: string) {
    const run = buildRunDetail(this.engine, runId)
    if (!run) return
    this.send(ws, { type: "run_snapshot", run })
  }

  private dropSocket(ws: WSContext) {
    const state = this.sockets.get(ws)
    if (!state) return
    for (const runId of state.runs) this.runWatchers.get(runId)?.delete(ws)
    for (const workflowId of state.workflows) {
      this.unsubscribeWorkflow(ws, workflowId)
    }
    for (const sub of state.logs.values()) clearInterval(sub.timer)
    this.sockets.delete(ws)
  }

  private send(ws: WSContext, message: WsServerMessage) {
    ws.send(JSON.stringify(message))
  }
}
