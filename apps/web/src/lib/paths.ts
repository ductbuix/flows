export type WorkflowTab = "overview" | "editor" | "runs"

/** Flat workflow URL. Missing/unknown tab is Overview (default). */
export function workflowPath(workflowId: string, tab?: WorkflowTab): string {
  if (!tab || tab === "overview") return `/workflows/${workflowId}`
  return `/workflows/${workflowId}?tab=${tab}`
}

export type ConnectionsTab = "connections" | "library"

/** Connections page URL. Default Connections tab omits `tab`. */
export function connectionsPath(tab?: ConnectionsTab): string {
  if (!tab || tab === "connections") return "/connections"
  return `/connections?tab=${tab}`
}

export function connectionPath(connectionId: string): string {
  return `/connections/${connectionId}`
}

export function parseConnectionsTab(
  value: string | null
): ConnectionsTab | null {
  if (value === "connections" || value === "library") return value
  return null
}

export type RunTaskTab = "output" | "terminal" | "attempts" | "environment"

export function runPath(runId: string): string {
  return `/runs/${runId}`
}

/** Deep link to a run task tab (e.g. failed task Terminal). */
export function runTaskPath(
  runId: string,
  taskId: string,
  tab: RunTaskTab = "output"
): string {
  const params = new URLSearchParams({ task: taskId })
  if (tab !== "output") params.set("tab", tab)
  return `/runs/${runId}?${params.toString()}`
}

export function parseRunTaskTab(value: string | null): RunTaskTab | null {
  if (
    value === "output" ||
    value === "terminal" ||
    value === "attempts" ||
    value === "environment"
  ) {
    return value
  }
  return null
}

export function parseWorkflowTab(value: string | null): WorkflowTab | null {
  if (value === "overview" || value === "editor" || value === "runs") {
    return value
  }
  return null
}
