import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { parseRunTaskTab, type RunTaskTab } from "@/lib/paths"

export type RunBodyView = "list" | "graph"

export function useSearchView() {
  const [searchParams, setSearchParams] = useSearchParams()

  const view: RunBodyView =
    searchParams.get("view") === "graph" ? "graph" : "list"
  const taskId = searchParams.get("task") ?? undefined
  const tab: RunTaskTab = parseRunTaskTab(searchParams.get("tab")) ?? "output"

  const setView = useCallback(
    (next: RunBodyView) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === "list") p.delete("view")
          else p.set("view", "graph")
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setTaskId = useCallback(
    (id: string | undefined) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (id) p.set("task", id)
          else p.delete("task")
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setTab = useCallback(
    (next: RunTaskTab) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === "output") p.delete("tab")
          else p.set("tab", next)
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  return useMemo(
    () => ({ view, taskId, tab, setView, setTaskId, setTab }),
    [view, taskId, tab, setView, setTaskId, setTab]
  )
}
