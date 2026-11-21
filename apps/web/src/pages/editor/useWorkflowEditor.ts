import { useCallback, useEffect, useState } from "react"
import { parseWorkflowYaml, workflowDetailSchema } from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { emptyEditorHistory, type EditorHistory } from "./editor-history"
import { saveWorkflowEditor } from "./editor-save"
import {
  activeEditorView,
  emptyEditorState,
  type EditorState,
} from "./editor-state"
import { useEditorMutations } from "./useEditorMutations"
import { useWorkflowSocket } from "./useWorkflowSocket"

export type { EditorState } from "./editor-state"

export function useWorkflowEditor(workflowId: string) {
  const [state, setState] = useState<EditorState>(emptyEditorState)
  const [history, setHistory] = useState<EditorHistory>(emptyEditorHistory)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.workflows[":workflowId"].$get({
        param: { workflowId },
      })
      if (!alive) return
      if (!res.ok) {
        setState((s) => ({ ...s, workflowId, loading: false }))
        toast.error("Could not load workflow")
        return
      }
      const detail = workflowDetailSchema.parse(await res.json())
      if (!alive) return
      setHistory(emptyEditorHistory)
      setState({
        workflowId,
        loading: false,
        yaml: detail.yaml,
        hash: detail.hash,
        workflow: detail.workflow,
        errors: detail.errors,
        dirty: false,
        conflict: null,
        showDiff: false,
      })
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  const onFileChanged = useCallback(
    (p: { path: string; hash: string; content: string }) => {
      if (p.path !== "workflow.yaml") return
      setState((s) => {
        if (s.workflowId !== workflowId || p.hash === s.hash) return s
        if (!s.dirty) {
          const parsed = parseWorkflowYaml(p.content)
          queueMicrotask(() => setHistory(emptyEditorHistory))
          toast.message("Reloaded from disk")
          return {
            ...s,
            yaml: p.content,
            hash: p.hash,
            workflow: parsed.workflow ?? s.workflow,
            errors: parsed.errors,
            dirty: false,
          }
        }
        return {
          ...s,
          conflict: { diskYaml: p.content, diskHash: p.hash },
        }
      })
    },
    [workflowId]
  )
  useWorkflowSocket(workflowId, { onFileChanged })

  const { yaml, workflow, hash, conflict, ...view } = activeEditorView(
    state,
    workflowId
  )

  const mutations = useEditorMutations({
    yaml: state.yaml,
    workflow,
    selectedTaskId: state.selectedTaskId,
    setState,
    history,
    setHistory,
  })

  const save = async () => {
    const result = await saveWorkflowEditor({
      workflowId,
      yaml,
      hash,
      beforeWorkflow: workflow,
    })
    if (result.ok) {
      setHistory(emptyEditorHistory)
      setState((s) => ({
        ...s,
        yaml: result.detail.yaml,
        hash: result.detail.hash,
        workflow: result.detail.workflow,
        errors: result.detail.errors,
        dirty: false,
        conflict: null,
        showDiff: false,
        loading: false,
      }))
      return
    }
    if (result.kind === "conflict") {
      setState((s) => ({
        ...s,
        conflict: { diskYaml: result.diskYaml, diskHash: result.diskHash },
      }))
      return
    }
    if (result.kind === "validation" && result.detail) {
      setState((s) => ({
        ...s,
        errors: result.detail!.errors,
        workflow: result.detail!.workflow ?? s.workflow,
      }))
    }
  }

  return {
    state: { ...view, yaml, workflow, hash, conflict },
    setSelectedTaskId: (id?: string) =>
      setState((s) => ({ ...s, selectedTaskId: id })),
    setShowDiff: (show: boolean) => setState((s) => ({ ...s, showDiff: show })),
    ...mutations,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    save,
    reloadConflict: () => {
      if (!conflict) return
      const parsed = parseWorkflowYaml(conflict.diskYaml)
      setHistory(emptyEditorHistory)
      setState((s) => ({
        ...s,
        yaml: conflict.diskYaml,
        hash: conflict.diskHash,
        workflow: parsed.workflow ?? s.workflow,
        errors: parsed.errors,
        dirty: false,
        conflict: null,
        showDiff: false,
      }))
    },
    keepConflict: () =>
      setState((s) => ({ ...s, conflict: null, showDiff: false })),
  }
}
