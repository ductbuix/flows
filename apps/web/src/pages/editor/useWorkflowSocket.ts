import { useEffect, useRef } from "react"
import { wsServerMessageSchema } from "@workspace/shared"
import { apiWebSocketUrl } from "@/lib/ws-url"

type Handlers = {
  onFileChanged: (payload: {
    path: string
    hash: string
    content: string
  }) => void
}

export function useWorkflowSocket(
  workflowId: string | undefined,
  handlers: Handlers
) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!workflowId) return
    const ws = new WebSocket(apiWebSocketUrl())

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe_workflow", workflowId }))
    })
    ws.addEventListener("message", (evt) => {
      let json: unknown
      try {
        json = JSON.parse(String(evt.data))
      } catch {
        return
      }
      const msg = wsServerMessageSchema.safeParse(json)
      if (!msg.success) return
      if (
        msg.data.type === "file_changed" &&
        msg.data.workflowId === workflowId
      ) {
        handlersRef.current.onFileChanged({
          path: msg.data.path,
          hash: msg.data.hash,
          content: msg.data.content,
        })
      }
    })

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe_workflow", workflowId }))
      }
      ws.close()
    }
  }, [workflowId])
}
