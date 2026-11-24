import { useCallback, useEffect, useRef, useState } from "react"
import { useFlowsClient } from "@workspace/sdk-react"

const SAVE_DELAY_MS = 400

/**
 * Text of a node file (`nodes/<id>/prompt.md`, `rule.md`, …): loads once,
 * saves a moment after the last keystroke, and on blur.
 */
export function useNodeFile(path: string | null) {
  const client = useFlowsClient()
  const [text, setText] = useState("")
  const [loaded, setLoaded] = useState(false)
  const hash = useRef<string | undefined>(undefined)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!path) return
    let alive = true
    void client
      .call("file/read_text", { path })
      .then((r) => {
        if (!alive) return
        hash.current = r.hash
        setText(r.text)
      })
      .catch(() => {
        hash.current = undefined
      })
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [client, path])

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const next = pending.current
    if (!path || next === null) return
    pending.current = null
    void client
      .call("file/write_text", {
        path,
        text: next,
        ...(hash.current ? { baseHash: hash.current } : {}),
      })
      .then((r) => {
        hash.current = r.hash
      })
      .catch(() => {
        // Changed on disk meanwhile: write over it without a base.
        hash.current = undefined
        pending.current = pending.current ?? next
      })
  }, [client, path])

  useEffect(() => flush, [flush])

  const change = useCallback(
    (next: string) => {
      setText(next)
      pending.current = next
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush]
  )

  return { text, loaded, change, flush }
}

export function nodeFilePath(workflowId: string, nodeId: string, file: string) {
  return `workflows/${workflowId}/nodes/${nodeId}/${file}`
}
