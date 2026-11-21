import { useCallback, useEffect, useState } from "react"
import type { RunSummary, RunStatus } from "@workspace/shared"
import { runSummarySchema, wsServerMessageSchema } from "@workspace/shared"
import { api } from "@/lib/api"
import { apiWebSocketUrl } from "@/lib/ws-url"

type Filters = {
  status?: RunStatus
  workflowId?: string
}

/** Load GET /runs and keep the list live via runs_changed. */
export function useRunsList(filters: Filters = {}) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await api.runs.$get({
      query: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.workflowId ? { workflowId: filters.workflowId } : {}),
      },
    })
    if (!res.ok) throw new Error("request failed")
    setRuns(runSummarySchema.array().parse(await res.json()))
    setError(null)
  }, [filters.status, filters.workflowId])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        await reload()
      } catch {
        if (alive) setError("Could not load runs")
      }
    })()
    return () => {
      alive = false
    }
  }, [reload])

  useEffect(() => {
    let alive = true
    const ws = new WebSocket(apiWebSocketUrl())

    ws.addEventListener("message", (evt) => {
      if (!alive) return
      let json: unknown
      try {
        json = JSON.parse(String(evt.data))
      } catch {
        return
      }
      const parsed = wsServerMessageSchema.safeParse(json)
      if (!parsed.success || parsed.data.type !== "runs_changed") return
      void reload().catch(() => {
        if (alive) setError("Could not reload runs")
      })
    })

    return () => {
      alive = false
      ws.close()
    }
  }, [reload])

  return { runs, error, reload }
}
