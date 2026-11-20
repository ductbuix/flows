import { useCallback, useEffect, useState } from "react"
import type { RunDetail } from "@workspace/shared"
import { runDetailSchema } from "@workspace/shared"
import { api } from "@/lib/api"

type FetchState = {
  runId: string
  loading: boolean
  error: string | null
  run: RunDetail | null
}

export function useRunFetch(runId: string) {
  const [state, setState] = useState<FetchState>({
    runId: "",
    loading: true,
    error: null,
    run: null,
  })

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.runs[":runId"].$get({ param: { runId } })
      if (!alive) return
      if (!res.ok) {
        setState({
          runId,
          loading: false,
          error: "Run not found",
          run: null,
        })
        return
      }
      setState({
        runId,
        loading: false,
        error: null,
        run: runDetailSchema.parse(await res.json()),
      })
    })()
    return () => {
      alive = false
    }
  }, [runId])

  const loading = state.runId !== runId || state.loading
  const error = state.runId === runId ? state.error : null
  const run = state.runId === runId ? state.run : null

  const setRun = useCallback(
    (next: RunDetail) =>
      setState({ runId, loading: false, error: null, run: next }),
    [runId]
  )

  return { run, loading, error, setRun }
}
