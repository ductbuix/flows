import { useEffect, useMemo, useState } from "react"
import type { WorkItemSummary } from "@workspace/shared"
import { workItemSummarySchema } from "@workspace/shared"
import { api } from "@/lib/api"

/** Load work item id → title map for Runs grouping (BL-041). */
export function useWorkItemTitles(): Map<string, string> {
  const [workItems, setWorkItems] = useState<WorkItemSummary[] | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.workitems.$get()
        if (!res.ok) throw new Error("request failed")
        const list = workItemSummarySchema.array().parse(await res.json())
        if (alive) setWorkItems(list)
      } catch {
        if (alive) setWorkItems([])
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return useMemo(() => {
    const map = new Map<string, string>()
    for (const item of workItems ?? []) map.set(item.id, item.title)
    return map
  }, [workItems])
}
