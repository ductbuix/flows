import { useEffect, useState } from "react"
import type { WorkflowInputDecl, WorkItemSummary } from "@workspace/shared"
import { workItemDetailSchema, workItemSummarySchema } from "@workspace/shared"
import { api } from "@/lib/api"

function mergePrefills(
  base: Record<string, string>,
  decls: WorkflowInputDecl[],
  prefills: Record<string, string>
): Record<string, string> {
  const next = { ...base }
  for (const decl of decls) {
    const saved = prefills[decl.name]
    if (saved !== undefined) next[decl.name] = saved
  }
  return next
}

/** Work item list, selection and input prefills for the Overview Start card. */
export function useOverviewWorkItem(
  decls: WorkflowInputDecl[],
  baseValues: Record<string, string>
) {
  const [workItems, setWorkItems] = useState<WorkItemSummary[]>([])
  const [workItemId, setWorkItemId] = useState<string | null>(null)
  const [workItemInputs, setWorkItemInputs] = useState<Record<string, string>>(
    {}
  )
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.workitems.$get()
        if (!res.ok) return
        const list = workItemSummarySchema.array().parse(await res.json())
        if (alive) setWorkItems(list)
      } catch {
        /* Start card still works without the list. */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    if (!workItemId) {
      setWorkItemInputs({})
      return
    }
    void (async () => {
      try {
        const res = await api.workitems[":id"].$get({
          param: { id: workItemId },
        })
        if (!res.ok || !alive) return
        const detail = workItemDetailSchema.parse(await res.json())
        if (alive) setWorkItemInputs(detail.item.inputs)
      } catch {
        if (alive) setWorkItemInputs({})
      }
    })()
    return () => {
      alive = false
    }
  }, [workItemId])

  useEffect(() => {
    setValues(mergePrefills(baseValues, decls, workItemInputs))
  }, [baseValues, decls, workItemInputs])

  return {
    workItems,
    workItemId,
    setWorkItemId,
    values,
    setValues,
  }
}
