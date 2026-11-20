import { useEffect, useRef, useState } from "react"
import type { RunDetail } from "@workspace/shared"
import { wsServerMessageSchema } from "@workspace/shared"
import { apiWebSocketUrl } from "@/lib/ws-url"

export type WsConnectionState = "connecting" | "open" | "closed"

type SocketState = {
  runId: string
  wsState: WsConnectionState
  stale: boolean
}

export function useRunSocket(
  runId: string | undefined,
  initial: RunDetail | null,
  onSnapshot: (run: RunDetail) => void
) {
  const [socket, setSocket] = useState<SocketState>({
    runId: "",
    wsState: "connecting",
    stale: false,
  })
  const lastSeqRef = useRef(initial?.lastSeq ?? 0)
  const onSnapshotRef = useRef(onSnapshot)

  useEffect(() => {
    onSnapshotRef.current = onSnapshot
  }, [onSnapshot])

  useEffect(() => {
    if (initial) lastSeqRef.current = initial.lastSeq
  }, [initial])

  useEffect(() => {
    if (!runId) return

    let alive = true
    const ws = new WebSocket(apiWebSocketUrl())

    const subscribe = () => {
      ws.send(
        JSON.stringify({
          type: "subscribe_run",
          runId,
          afterSeq: lastSeqRef.current,
        })
      )
    }

    ws.addEventListener("open", () => {
      if (!alive) return
      setSocket({ runId, wsState: "open", stale: false })
      subscribe()
    })

    ws.addEventListener("message", (evt) => {
      if (!alive) return
      let json: unknown
      try {
        json = JSON.parse(String(evt.data))
      } catch {
        return
      }
      const parsed = wsServerMessageSchema.safeParse(json)
      if (!parsed.success) return
      const msg = parsed.data
      if (msg.type === "run_snapshot") {
        lastSeqRef.current = msg.run.lastSeq
        onSnapshotRef.current(msg.run)
      } else if (msg.type === "engine_event") {
        lastSeqRef.current = Math.max(lastSeqRef.current, msg.seq)
      }
    })

    ws.addEventListener("close", () => {
      if (!alive) return
      setSocket((prev) =>
        prev.runId === runId ? { runId, wsState: "closed", stale: true } : prev
      )
    })

    ws.addEventListener("error", () => {
      if (!alive) return
      setSocket((prev) =>
        prev.runId === runId ? { runId, wsState: "closed", stale: true } : prev
      )
    })

    return () => {
      alive = false
      ws.close()
    }
  }, [runId])

  const wsState =
    runId && socket.runId === runId ? socket.wsState : "connecting"
  const stale = Boolean(runId && socket.runId === runId && socket.stale)

  return { wsState, stale }
}
