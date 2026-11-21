import { useCallback, useEffect, useState } from "react"
import {
  parseWorkflowYaml,
  workflowConflictSchema,
  workflowDetailSchema,
  type Task,
  type Workflow,
  type WorkflowDetail,
} from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"
import {
  yamlAfterAddTask,
  yamlAfterConnect,
  yamlAfterGoal,
  yamlAfterTaskPatch,
} from "./editor-mutations"
import {
  activeEditorView,
  emptyEditorState,
  type EditorState,
} from "./editor-state"
import { useWorkflowSocket } from "./useWorkflowSocket"

export type { EditorState } from "./editor-state"

export function useWorkflowEditor(workflowId: string) {
  const [state, setState] = useState<EditorState>(emptyEditorState)

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

  const withYaml = (
    nextYaml: string,
    extra?: Partial<EditorState> & { fallbackWorkflow?: Workflow }
  ) => {
    const parsed = parseWorkflowYaml(nextYaml)
    const { fallbackWorkflow, ...rest } = extra ?? {}
    setState((s) => ({
      ...s,
      yaml: nextYaml,
      dirty: true,
      errors: parsed.errors,
      workflow: parsed.workflow ?? fallbackWorkflow ?? s.workflow,
      ...rest,
    }))
  }

  const save = async () => {
    const res = await api.workflows[":workflowId"].$put({
      param: { workflowId },
      json: { yaml, baseHash: hash },
    })
    if (res.status === 409) {
      const body = workflowConflictSchema.parse(await res.json())
      setState((s) => ({
        ...s,
        conflict: { diskYaml: body.diskYaml, diskHash: body.diskHash },
      }))
      return
    }
    if (res.status === 400) {
      const detail = workflowDetailSchema.parse(await res.json())
      setState((s) => ({
        ...s,
        errors: detail.errors,
        workflow: detail.workflow ?? s.workflow,
      }))
      toast.error("Save failed: invalid YAML")
      return
    }
    if (!res.ok) {
      toast.error("Save failed")
      return
    }
    const detail: WorkflowDetail = workflowDetailSchema.parse(await res.json())
    setState((s) => ({
      ...s,
      yaml: detail.yaml,
      hash: detail.hash,
      workflow: detail.workflow,
      errors: detail.errors,
      dirty: false,
      conflict: null,
      showDiff: false,
      loading: false,
    }))
    toast.success("Saved")
  }

  return {
    state: { ...view, yaml, workflow, hash, conflict },
    setSelectedTaskId: (id?: string) =>
      setState((s) => ({ ...s, selectedTaskId: id })),
    setShowDiff: (show: boolean) => setState((s) => ({ ...s, showDiff: show })),
    setYaml: (next: string) => withYaml(next),
    addCommandTask: () => {
      if (!workflow) return
      const next = yamlAfterAddTask(yaml, workflow)
      withYaml(next.yaml, { selectedTaskId: next.taskId })
    },
    connectTasks: (source: string, target: string) => {
      if (!workflow) return
      const next = yamlAfterConnect(yaml, workflow, source, target)
      if (next) withYaml(next)
    },
    changeGoal: (goal: string) => withYaml(yamlAfterGoal(yaml, goal)),
    changeTask: (taskId: string, patch: Partial<Task>) => {
      if (!workflow) return
      const next = yamlAfterTaskPatch(yaml, workflow, taskId, patch)
      withYaml(next.yaml, { fallbackWorkflow: next.workflow })
    },
    save,
    reloadConflict: () => {
      if (!conflict) return
      const parsed = parseWorkflowYaml(conflict.diskYaml)
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
