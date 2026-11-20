import { useEffect, useRef, useState } from "react"
import { logChunkSchema, wsServerMessageSchema } from "@workspace/shared"
import { api } from "@/lib/api"
import { apiWebSocketUrl } from "@/lib/ws-url"

export type LogStream = "stdout" | "stderr"

function logSlot(
  runId: string,
  taskId: string,
  attempt: number,
  stream: LogStream
) {
  return `${runId}:${taskId}:${attempt}:${stream}`
}

export function useTaskLog(
  runId: string,
  taskId: string,
  attempt: number,
  stream: LogStream
) {
  const slot = logSlot(runId, taskId, attempt, stream)
  const [state, setState] = useState({
    slot: "",
    text: "",
    loading: true,
  })
  const offsetRef = useRef(0)

  const loading = state.slot !== slot || state.loading
  const text = state.slot === slot ? state.text : ""

  useEffect(() => {
    let alive = true
    offsetRef.current = 0

    void (async () => {
      try {
        const res = await api.runs[":runId"].tasks[":taskId"].attempts[
          ":n"
        ].log.$get({
          param: {
            runId,
            taskId,
            n: String(attempt),
          },
          query: { stream, offset: "0" },
        })
        if (!res.ok || !alive) return
        const chunk = logChunkSchema.parse(await res.json())
        offsetRef.current = chunk.nextOffset
        setState({ slot, text: chunk.text, loading: false })
      } catch {
        if (alive) setState({ slot, text: "", loading: false })
      }
    })()

    const ws = new WebSocket(apiWebSocketUrl())

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          type: "subscribe_log",
          runId,
          taskId,
          attempt,
          stream,
          offset: offsetRef.current,
        })
      )
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
      if (!parsed.success || parsed.data.type !== "log_chunk") return
      const msg = parsed.data
      if (
        msg.runId !== runId ||
        msg.taskId !== taskId ||
        msg.attempt !== attempt ||
        msg.chunk.stream !== stream
      ) {
        return
      }
      if (msg.chunk.offset < offsetRef.current) return
      offsetRef.current = msg.chunk.nextOffset
      setState((prev) =>
        prev.slot === slot
          ? { slot, text: prev.text + msg.chunk.text, loading: false }
          : prev
      )
    })

    return () => {
      alive = false
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "unsubscribe_log",
            runId,
            taskId,
            attempt,
            stream,
          })
        )
      }
      ws.close()
    }
  }, [runId, taskId, attempt, stream, slot])

  return { text, loading }
}
