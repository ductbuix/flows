import { useEffect, useState } from "react"
import type { RunSummary } from "@workspace/shared"
import { runSummarySchema, wsServerMessageSchema } from "@workspace/shared"
import { api } from "@/lib/api"
import { apiWebSocketUrl } from "@/lib/ws-url"

function sortNewestFirst(items: RunSummary[]): RunSummary[] {
  return [...items].sort((a, b) => {
    const byTime = b.startedAt.localeCompare(a.startedAt)
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
  })
}

function upsertSummary(
  prev: RunSummary[],
  runId: string,
  summary: RunSummary | null
): RunSummary[] {
  const next = prev.filter((r) => r.id !== runId)
  if (summary) next.push(summary)
  return sortNewestFirst(next)
}

/** All run summaries with live `runs_changed` updates (DES-025 / BL-035). */
export function useRunSummaries() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.runs.$get()
        if (!res.ok) throw new Error("request failed")
        const items = runSummarySchema.array().parse(await res.json())
        if (alive) {
          setRuns(sortNewestFirst(items))
          setError(null)
        }
      } catch {
        if (alive) setError("Could not load runs")
      }
    })()
    return () => {
      alive = false
    }
  }, [])

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
      const { runId, summary } = parsed.data
      setRuns((prev) => (prev ? upsertSummary(prev, runId, summary) : prev))
    })

    return () => {
      alive = false
      ws.close()
    }
  }, [])

  return { runs, error }
}
