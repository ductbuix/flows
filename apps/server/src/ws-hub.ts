import type { Engine, StoredEvent } from "@workspace/engine"
import {
  engineEventSchema,
  wsClientMessageSchema,
  type WsServerMessage,
} from "@workspace/shared"
import type { WSContext, WSEvents } from "hono/ws"
import { buildRunDetail } from "./run-detail.ts"
import { type LogSub, logSubKey, startLogSubscription } from "./ws-log.ts"

type SocketState = {
  runs: Set<string>
  logs: Map<string, LogSub>
}

export class WsHub {
  private readonly offEvent: () => void
  private readonly sockets = new Map<WSContext, SocketState>()
  private readonly runWatchers = new Map<string, Set<WSContext>>()

  constructor(private readonly engine: Engine) {
    this.offEvent = engine.onEvent((stored) => {
      const sockets = this.runWatchers.get(stored.event.runId)
      if (!sockets) return
      for (const ws of sockets) this.pushRunEvent(ws, stored)
    })
  }

  dispose(): void {
    this.offEvent()
    for (const state of this.sockets.values()) {
      for (const sub of state.logs.values()) clearInterval(sub.timer)
    }
    this.sockets.clear()
    this.runWatchers.clear()
  }

  connection(): WSEvents {
    return {
      onOpen: (_evt, ws) => {
        this.sockets.set(ws, { runs: new Set(), logs: new Map() })
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
    if (msg.type === "subscribe_run") {
      this.subscribeRun(ws, msg.runId, msg.afterSeq ?? 0)
    } else if (msg.type === "unsubscribe_run") {
      this.unsubscribeRun(ws, msg.runId)
    } else if (msg.type === "subscribe_log") {
      this.subscribeLog(ws, msg)
    } else {
      this.unsubscribeLog(ws, msg.runId, msg.taskId, msg.attempt, msg.stream)
    }
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
    for (const sub of state.logs.values()) clearInterval(sub.timer)
    this.sockets.delete(ws)
  }

  private send(ws: WSContext, message: WsServerMessage) {
    ws.send(JSON.stringify(message))
  }
}
