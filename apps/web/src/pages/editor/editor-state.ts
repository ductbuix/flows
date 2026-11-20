import type { Workflow, YamlDiagnosticDto } from "@workspace/shared"

export type EditorState = {
  workflowId: string
  loading: boolean
  yaml: string
  hash: string
  workflow: Workflow | null
  errors: YamlDiagnosticDto[]
  dirty: boolean
  selectedTaskId?: string
  conflict: { diskYaml: string; diskHash: string } | null
  showDiff: boolean
}

export const emptyEditorState: EditorState = {
  workflowId: "",
  loading: true,
  yaml: "",
  hash: "",
  workflow: null,
  errors: [],
  dirty: false,
  conflict: null,
  showDiff: false,
}

/** Project hook state for the current route workflowId. */
export function activeEditorView(state: EditorState, workflowId: string) {
  const active = state.workflowId === workflowId
  return {
    loading: !active || state.loading,
    yaml: active ? state.yaml : "",
    hash: active ? state.hash : "",
    workflow: active ? state.workflow : null,
    errors: active ? state.errors : [],
    dirty: active ? state.dirty : false,
    selectedTaskId: active ? state.selectedTaskId : undefined,
    conflict: active ? state.conflict : null,
    showDiff: active ? state.showDiff : false,
  }
}
