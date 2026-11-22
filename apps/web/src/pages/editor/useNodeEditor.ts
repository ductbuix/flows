import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  layoutFileSchema,
  nodeWorkflowDetailSchema,
  parseNodeWorkflowYaml,
  removeNode as yamlRemoveNode,
  setNodeKey,
  workflowFileConflictSchema,
  workflowFileDetailSchema,
  type NodeWorkflow,
  type NodeWorkflowDetail,
} from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { nodeTextPath } from "@/nodes"
import {
  emptyEditorHistory,
  pushEditorSnapshot,
  redoEditor,
  undoEditor,
  type EditorHistory,
} from "./editor-history"
import type { Pos } from "./node-canvas-layout"
import { yamlAfterAddNode, yamlAfterSample, type WireSide } from "./node-add"

const SAVE_DELAY_MS = 400

export type NodeEditorState = {
  loading: boolean
  detail: NodeWorkflowDetail | null
  saved: Record<string, Pos>
  /** Unsaved workflow text; differs from `detail.yaml` while dirty. */
  draft: string
  /** Unsaved node file edits by workflow-relative path. */
  files: Record<string, string>
  /** Node files as on disk; `hash` is missing when the file did not exist. */
  base: Record<string, { content: string; hash?: string }>
  history: EditorHistory
  /** Key of the typing run in progress, so it is one undo step. */
  typing?: string
}

/** An edit to the draft: new YAML and/or node file edits. */
type Change = {
  yaml?: string
  files?: Record<string, string>
  /** Edits with the same key in a row share one undo step. */
  key?: string
}

/** Applies a change and records the undo step. */
function applyChange(s: NodeEditorState, c: Change): NodeEditorState {
  const same = c.key !== undefined && c.key === s.typing
  return {
    ...s,
    draft: c.yaml ?? s.draft,
    files: c.files ?? s.files,
    history: same
      ? s.history
      : pushEditorSnapshot(s.history, { yaml: s.draft, files: s.files }),
    typing: c.key,
  }
}

/** Loads the node workflow and its layout; saves positions debounced. */
export function useNodeEditor(workflowId: string) {
  const [state, setState] = useState<NodeEditorState>({
    loading: true,
    detail: null,
    saved: {},
    draft: "",
    files: {},
    base: {},
    history: emptyEditorHistory,
  })
  const dirty = useRef(false)
  const requested = useRef(new Set<string>())

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
        setState((s) => ({ ...s, loading: false }))
        toast.error("Could not load workflow")
        return
      }
      const detail = nodeWorkflowDetailSchema.parse(await wf.json())
      const layout = lay.ok ? layoutFileSchema.parse(await lay.json()) : null
      if (!alive) return
      requested.current.clear()
      setState({
        loading: false,
        detail,
        saved: layout?.nodes ?? {},
        draft: detail.yaml,
        files: {},
        base: {},
        history: emptyEditorHistory,
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

  const textPaths = useMemo(
    () =>
      (workflow?.nodes ?? []).flatMap((n) => {
        const path = nodeTextPath(n)
        return path ? [path] : []
      }),
    [workflow]
  )

  // Load each node text file once; a missing file reads as empty.
  useEffect(() => {
    for (const path of textPaths) {
      if (requested.current.has(path)) continue
      requested.current.add(path)
      void (async () => {
        const res = await api.workflows[":workflowId"].files[":path"].$get({
          param: { workflowId, path },
        })
        const file = res.ok
          ? workflowFileDetailSchema.parse(await res.json())
          : null
        setState((s) => ({
          ...s,
          base: {
            ...s.base,
            [path]: { content: file?.content ?? "", hash: file?.hash },
          },
        }))
      })()
    }
  }, [textPaths, workflowId])

  /** The text of a node file: the unsaved edit, else the file on disk. */
  const textOf = useCallback(
    (path: string) => state.files[path] ?? state.base[path]?.content ?? "",
    [state.files, state.base]
  )

  const dirtyPaths = textPaths.filter(
    (p) => state.files[p] !== undefined && state.files[p] !== (state.base[p]?.content ?? "")
  )
  const yamlDirty = !!state.detail && state.draft !== state.detail.yaml
  const isDirty = yamlDirty || dirtyPaths.length > 0
  dirty.current = isDirty

  /** Adds a node at `pos` (and wires it when dropped from a wire). */
  const addNode = useCallback(
    (kind: string, pos: Pos, current: Record<string, Pos>, wire?: WireSide) => {
      setState((s) => {
        const added = yamlAfterAddNode(s.draft, kind, wire)
        pending.current = { ...current, [added.id]: pos }
        return {
          ...applyChange(s, { yaml: added.yaml }),
          saved: { ...current, [added.id]: pos },
        }
      })
    },
    []
  )

  const addSample = useCallback((current: Record<string, Pos>) => {
    setState((s) => ({
      ...applyChange(s, { yaml: yamlAfterSample(s.draft) }),
      saved: current,
    }))
  }, [])

  const addEdgeYaml = useCallback((next: (yaml: string) => string) => {
    setState((s) => applyChange(s, { yaml: next(s.draft) }))
  }, [])

  /** Sets a node's YAML key; `undefined` removes it. */
  const setSetting = useCallback(
    (id: string, key: string, value: unknown) => {
      setState((s) =>
        applyChange(s, {
          yaml: setNodeKey(s.draft, id, key, value),
          key: `set:${id}:${key}`,
        })
      )
    },
    []
  )

  /** Removes a node and its edges; Save trashes its folder (the PUT). */
  const removeNode = useCallback((id: string) => {
    setState((s) =>
      applyChange(s, { yaml: yamlRemoveNode(s.draft, id), key: undefined })
    )
  }, [])

  /** Edits a node file; written by Save through the file PUT. */
  const setText = useCallback((path: string, content: string) => {
    setState((s) =>
      applyChange(s, {
        files: { ...s.files, [path]: content },
        key: `text:${path}`,
      })
    )
  }, [])

  const endEdit = useCallback(
    () => setState((s) => (s.typing === undefined ? s : { ...s, typing: undefined })),
    []
  )

  const undo = useCallback(() => {
    setState((s) => {
      const r = undoEditor(s.history, { yaml: s.draft, files: s.files })
      if (!r) return s
      return {
        ...s,
        draft: r.snap.yaml,
        files: r.snap.files ?? {},
        history: r.history,
        typing: undefined,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((s) => {
      const r = redoEditor(s.history, { yaml: s.draft, files: s.files })
      if (!r) return s
      return {
        ...s,
        draft: r.snap.yaml,
        files: r.snap.files ?? {},
        history: r.history,
        typing: undefined,
      }
    })
  }, [])

  const save = useCallback(async () => {
    if (!state.detail || !isDirty) return
    let detail = state.detail
    if (yamlDirty) {
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
      detail = nodeWorkflowDetailSchema.parse(await res.json())
    }
    // Node files go after the YAML, which creates the files of new nodes.
    const written: NodeEditorState["base"] = {}
    for (const path of dirtyPaths) {
      const content = state.files[path]!
      const res = await api.workflows[":workflowId"].files[":path"].$put({
        param: { workflowId, path },
        json: { content, baseHash: state.base[path]?.hash },
      })
      if (res.status === 409) {
        workflowFileConflictSchema.parse(await res.json())
        toast.error(`${path} changed on disk. Reload to continue.`)
        return
      }
      if (!res.ok) {
        toast.error(`Could not save ${path}`)
        return
      }
      const file = workflowFileDetailSchema.parse(await res.json())
      written[path] = { content: file.content, hash: file.hash }
    }
    dirty.current = false
    setState((s) => {
      const files = { ...s.files }
      for (const p of Object.keys(written)) {
        if (files[p] === written[p]!.content) delete files[p]
      }
      return {
        ...s,
        detail,
        draft: yamlDirty ? detail.yaml : s.draft,
        files,
        base: { ...s.base, ...written },
      }
    })
    await flush()
    toast.success("Saved")
  }, [state, isDirty, yamlDirty, dirtyPaths, workflowId, flush])

  return {
    ...state,
    workflow,
    errors: parsed?.errors ?? [],
    dirty: isDirty,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    textOf,
    savePositions,
    addNode,
    addSample,
    addEdgeYaml,
    setSetting,
    removeNode,
    setText,
    endEdit,
    undo,
    redo,
    save,
  }
}
