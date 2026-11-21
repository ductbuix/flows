export type WorkflowTab = "overview" | "editor" | "runs"

/** Flat workflow URL. Missing/unknown tab is treated as editor by the page. */
export function workflowPath(workflowId: string, tab?: WorkflowTab): string {
  if (!tab || tab === "editor") return `/workflows/${workflowId}`
  return `/workflows/${workflowId}?tab=${tab}`
}

export function runPath(runId: string): string {
  return `/runs/${runId}`
}

export function parseWorkflowTab(value: string | null): WorkflowTab | null {
  if (value === "overview" || value === "editor" || value === "runs") {
    return value
  }
  return null
}
