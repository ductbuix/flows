import type {
  Task,
  Workflow,
  WorkflowAgent,
  WorkflowInputDecl,
  WorkflowLimits,
} from "@workspace/shared"
import { parseWorkflowYaml } from "@workspace/shared"
import type { Dispatch, SetStateAction } from "react"
import {
  pushEditorSnapshot,
  redoEditor,
  undoEditor,
  type EditorHistory,
  type EditorSnapshot,
} from "./editor-history"
import {
  firstProposeConnection,
  yamlAfterAddPublishTask,
  yamlAfterAddTask,
  yamlAfterAgent,
  yamlAfterConnect,
  yamlAfterGoal,
  yamlAfterName,
  yamlAfterInputs,
  yamlAfterLimits,
  yamlAfterRemoveTask,
  yamlAfterTaskPatch,
} from "./editor-mutations"
import type { EditorState } from "./editor-state"

type Args = {
  yaml: string
  workflow: Workflow | null
  selectedTaskId?: string
  setState: Dispatch<SetStateAction<EditorState>>
  history: EditorHistory
  setHistory: Dispatch<SetStateAction<EditorHistory>>
}

/** Graph and inspector yaml mutations with snapshot undo (DES-022). */
export function useEditorMutations({
  yaml,
  workflow,
  selectedTaskId,
  setState,
  history,
  setHistory,
}: Args) {
  const snapshot = (): EditorSnapshot => ({ yaml, selectedTaskId })

  const withYaml = (
    nextYaml: string,
    extra?: Partial<EditorState> & {
      fallbackWorkflow?: Workflow
      recordHistory?: boolean
    }
  ) => {
    const { fallbackWorkflow, recordHistory = true, ...rest } = extra ?? {}
    const parsed = parseWorkflowYaml(nextYaml)
    if (recordHistory) {
      setHistory((h) => pushEditorSnapshot(h, snapshot()))
    }
    setState((s) => ({
      ...s,
      yaml: nextYaml,
      dirty: true,
      errors: parsed.errors,
      workflow: parsed.workflow ?? fallbackWorkflow ?? s.workflow,
      ...rest,
    }))
  }

  const applySnap = (snap: EditorSnapshot) => {
    const parsed = parseWorkflowYaml(snap.yaml)
    setState((s) => ({
      ...s,
      yaml: snap.yaml,
      selectedTaskId: snap.selectedTaskId,
      dirty: true,
      errors: parsed.errors,
      workflow: parsed.workflow ?? s.workflow,
    }))
  }

  return {
    setYaml: (next: string) => withYaml(next, { recordHistory: false }),
    addCommandTask: () => {
      if (!workflow) return
      const next = yamlAfterAddTask(yaml, workflow)
      withYaml(next.yaml, { selectedTaskId: next.taskId })
    },
    addPublishTask: () => {
      if (!workflow) return
      const connection = firstProposeConnection(workflow) ?? "connection"
      const next = yamlAfterAddPublishTask(yaml, workflow, connection)
      withYaml(next.yaml, { selectedTaskId: next.taskId })
    },
    connectTasks: (source: string, target: string) => {
      if (!workflow) return
      const next = yamlAfterConnect(yaml, workflow, source, target)
      if (next) withYaml(next)
    },
    changeName: (name: string) => withYaml(yamlAfterName(yaml, name)),
    changeGoal: (goal: string) => withYaml(yamlAfterGoal(yaml, goal)),
    changeInputs: (inputs: WorkflowInputDecl[] | undefined) =>
      withYaml(yamlAfterInputs(yaml, inputs)),
    changeLimits: (limits: WorkflowLimits | undefined) =>
      withYaml(yamlAfterLimits(yaml, limits)),
    changeAgent: (agent: WorkflowAgent | undefined) =>
      withYaml(yamlAfterAgent(yaml, agent)),
    changeTask: (taskId: string, patch: Partial<Task>) => {
      if (!workflow) return
      const next = yamlAfterTaskPatch(yaml, workflow, taskId, patch)
      withYaml(next.yaml, { fallbackWorkflow: next.workflow })
    },
    removeTaskPending: (taskId: string) => {
      if (!workflow || workflow.tasks.length <= 1) return
      withYaml(yamlAfterRemoveTask(yaml, taskId), {
        selectedTaskId: selectedTaskId === taskId ? undefined : selectedTaskId,
      })
    },
    undo: () => {
      const result = undoEditor(history, snapshot())
      if (!result) return
      setHistory(result.history)
      applySnap(result.snap)
    },
    redo: () => {
      const result = redoEditor(history, snapshot())
      if (!result) return
      setHistory(result.history)
      applySnap(result.snap)
    },
  }
}
