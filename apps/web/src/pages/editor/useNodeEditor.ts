import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  layoutFileSchema,
  nodeWorkflowDetailSchema,
  parseNodeWorkflowYaml,
  type NodeWorkflow,
  type NodeWorkflowDetail,
} from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Pos } from "./node-canvas-layout"
import { yamlAfterAddNode, yamlAfterSample, type WireSide } from "./node-add"

const SAVE_DELAY_MS = 400

export type NodeEditorState = {
  loading: boolean
  detail: NodeWorkflowDetail | null
  saved: Record<string, Pos>
  /** Unsaved workflow text; differs from `detail.yaml` while dirty. */
  draft: string
}

/** Loads the node workflow and its layout; saves positions debounced. */
export function useNodeEditor(workflowId: string) {
  const [state, setState] = useState<NodeEditorState>({
    loading: true,
    detail: null,
    saved: {},
    draft: "",
  })
  const dirty = useRef(false)

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
        setState({ loading: false, detail: null, saved: {}, draft: "" })
        toast.error("Could not load workflow")
        return
      }
      const detail = nodeWorkflowDetailSchema.parse(await wf.json())
      const layout = lay.ok ? layoutFileSchema.parse(await lay.json()) : null
      if (!alive) return
      setState({
        loading: false,
        detail,
        saved: layout?.nodes ?? {},
        draft: detail.yaml,
      })
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<Record<string, Pos> | undefined>(undefined)

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    // Positions of unsaved nodes would be dropped by the server; wait for Save.
    if (dirty.current) return
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
      setState((s) => ({ ...s, saved: nodes }))
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush]
  )

  // Write a pending save when leaving the editor.
  useEffect(() => () => void flush(), [flush])

  const parsed = useMemo(
    () => (state.draft ? parseNodeWorkflowYaml(state.draft) : null),
    [state.draft]
  )
  const workflow: NodeWorkflow | null = parsed?.workflow ?? null
  const isDirty = !!state.detail && state.draft !== state.detail.yaml
  dirty.current = isDirty

  /** Adds a node at `pos` (and wires it when dropped from a wire). */
  const addNode = useCallback(
    (kind: string, pos: Pos, current: Record<string, Pos>, wire?: WireSide) => {
      setState((s) => {
        const added = yamlAfterAddNode(s.draft, kind, wire)
        pending.current = { ...current, [added.id]: pos }
        return {
          ...s,
          draft: added.yaml,
          saved: { ...current, [added.id]: pos },
        }
      })
    },
    []
  )

  const addSample = useCallback(
    (current: Record<string, Pos>) => {
      setState((s) => ({
        ...s,
        draft: yamlAfterSample(s.draft),
        saved: current,
      }))
    },
    []
  )

  const addEdgeYaml = useCallback((next: (yaml: string) => string) => {
    setState((s) => ({ ...s, draft: next(s.draft) }))
  }, [])

  const save = useCallback(async () => {
    if (!state.detail || !isDirty) return
    const res = await api.workflows[":workflowId"].$put({
      param: { workflowId },
      json: { yaml: state.draft, baseHash: state.detail.hash },
    })
    if (res.status === 409) {
      toast.error("The workflow changed on disk. Reload to continue.")
      return
    }
    if (!res.ok) {
      toast.error("Could not save the workflow")
      return
    }
    const detail = nodeWorkflowDetailSchema.parse(await res.json())
    dirty.current = false
    setState((s) => ({ ...s, detail, draft: detail.yaml }))
    await flush()
    toast.success("Saved")
  }, [state.detail, state.draft, isDirty, workflowId, flush])

  return {
    ...state,
    workflow,
    errors: parsed?.errors ?? [],
    dirty: isDirty,
    savePositions,
    addNode,
    addSample,
    addEdgeYaml,
    save,
  }
}
