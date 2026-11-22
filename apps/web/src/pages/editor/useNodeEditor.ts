import { useCallback, useEffect, useRef, useState } from "react"
import {
  layoutFileSchema,
  nodeWorkflowDetailSchema,
  type NodeWorkflowDetail,
} from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Pos } from "./node-canvas-layout"

const SAVE_DELAY_MS = 400

export type NodeEditorState = {
  loading: boolean
  detail: NodeWorkflowDetail | null
  saved: Record<string, Pos>
}

/** Loads the node workflow and its layout; saves positions debounced. */
export function useNodeEditor(workflowId: string) {
  const [state, setState] = useState<NodeEditorState>({
    loading: true,
    detail: null,
    saved: {},
  })

  useEffect(() => {
    let alive = true
    const param = { param: { workflowId } }
    void (async () => {
      const [wf, lay] = await Promise.all([
        api.workflows[":workflowId"].$get(param),
        api.workflows[":workflowId"].layout.$get(param),
      ])
      if (!alive) return
      if (!wf.ok) {
        setState({ loading: false, detail: null, saved: {} })
        toast.error("Could not load workflow")
        return
      }
      const detail = nodeWorkflowDetailSchema.parse(await wf.json())
      const layout = lay.ok ? layoutFileSchema.parse(await lay.json()) : null
      if (!alive) return
      setState({ loading: false, detail, saved: layout?.nodes ?? {} })
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<Record<string, Pos> | undefined>(undefined)

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const nodes = pending.current
    pending.current = undefined
    if (!nodes) return
    const res = await api.workflows[":workflowId"].layout.$put({
      param: { workflowId },
      json: { version: 1, nodes },
    })
    if (!res.ok) toast.error("Could not save node positions")
  }, [workflowId])

  const savePositions = useCallback(
    (nodes: Record<string, Pos>) => {
      pending.current = nodes
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush]
  )

  // Write a pending save when leaving the editor.
  useEffect(() => () => void flush(), [flush])

  return { ...state, savePositions }
}
