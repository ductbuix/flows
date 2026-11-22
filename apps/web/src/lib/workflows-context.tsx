import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { WorkflowSummary } from "@workspace/shared"
import { workflowSummarySchema } from "@workspace/shared"
import { api } from "@/lib/api"
import { workflowLabel } from "@/lib/labels"

type WorkflowsContextValue = {
  workflows: WorkflowSummary[] | null
  error: string | null
  reload: () => Promise<void>
}

const WorkflowsContext = createContext<WorkflowsContextValue | null>(null)

export function WorkflowsProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await api.workflows.$get()
    if (!res.ok) throw new Error("request failed")
    setWorkflows(workflowSummarySchema.array().parse(await res.json()))
    setError(null)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        await reload()
      } catch {
        if (alive) setError("Could not load workflows")
      }
    })()
    return () => {
      alive = false
    }
  }, [reload])

  const value = useMemo(
    () => ({ workflows, error, reload }),
    [workflows, error, reload]
  )

  return (
    <WorkflowsContext.Provider value={value}>
      {children}
    </WorkflowsContext.Provider>
  )
}

export function useWorkflows() {
  const ctx = useContext(WorkflowsContext)
  if (!ctx)
    throw new Error("useWorkflows must be used within WorkflowsProvider")
  return ctx
}

/** Display label for a workflow id; `override` wins (unsaved editor name). */
export function useWorkflowLabel(workflowId: string, override?: string) {
  const { workflows } = useWorkflows()
  const summary = workflows?.find((wf) => wf.id === workflowId)
  return workflowLabel({
    id: workflowId,
    name: override?.trim() || summary?.name,
  })
}
