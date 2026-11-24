import { useCallback, useEffect, useRef, useState } from "react"
import type { RunStep, RunSummary } from "@workspace/contracts"
import { useFlowsClient, useSubscription } from "@workspace/sdk-react"
import { retryStep } from "@/components/runs/run-actions"
import { statesFromSteps } from "./node-run-view"
import type { RunState } from "./flow-kinds"

const RESULT_MAX = 600

export type NodeView = {
  state: RunState
  result?: string
  failReason?: string
  attempts: number
}

type RunGet = RunSummary & { steps?: RunStep[] }

type Cache = {
  runId: string
  steps: RunStep[]
  results: Record<string, string>
  summary: RunSummary | null
}

async function fetchLog(
  client: ReturnType<typeof useFlowsClient>,
  runId: string,
  stepId: string,
  attempt: number,
  failed: boolean
): Promise<string> {
  for (const stream of failed
    ? (["stderr", "stdout"] as const)
    : (["stdout"] as const)) {
    try {
      const chunk = await client.call("run/get_log", {
        runId,
        stepId,
        attempt,
        stream,
        offset: 0,
      })
      const text = chunk.text.trim()
      if (text) {
        return text.length > RESULT_MAX ? `${text.slice(0, RESULT_MAX)}…` : text
      }
    } catch {
      // attempt or stream may not exist yet
    }
  }
  return ""
}

/** Follow one run for canvas status, logs and Retry (BL-203). */
export function useCanvasRun(runId: string | null) {
  const client = useFlowsClient()
  const [cache, setCache] = useState<Cache | null>(null)
  const fetched = useRef(new Set<string>())
  const active = cache?.runId === runId ? cache : null
  const steps = active?.steps

  const applyGet = useCallback((id: string, data: RunGet) => {
    setCache((prev) => ({
      runId: id,
      steps: data.steps ?? [],
      results: prev?.runId === id ? prev.results : {},
      summary: data,
    }))
  }, [])

  useEffect(() => {
    if (!runId) return
    let alive = true
    fetched.current.clear()
    void client.call("run/get", { id: runId }).then(
      (data) => {
        if (alive) applyGet(runId, data as RunGet)
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [client, runId, applyGet])

  const onNotify = useCallback(
    (params: unknown) => {
      if (!runId || !params || typeof params !== "object") return
      const p = params as {
        kind?: string
        runId?: string
        step?: RunStep
        summary?: RunSummary | null
      }
      if (p.runId !== runId) return
      if (p.kind === "step_state" && p.step) {
        const step = p.step
        setCache((prev) => {
          if (!prev || prev.runId !== runId) {
            return { runId, steps: [step], results: {}, summary: null }
          }
          const i = prev.steps.findIndex((s) => s.nodeId === step.nodeId)
          const nextSteps =
            i < 0
              ? [...prev.steps, step]
              : prev.steps.map((s, idx) => (idx === i ? step : s))
          return { ...prev, steps: nextSteps }
        })
      }
      if (
        (p.kind === "run_changed" || p.kind === "run_finished") &&
        p.summary
      ) {
        const summary = p.summary
        setCache((prev) =>
          prev && prev.runId === runId
            ? { ...prev, summary }
            : { runId, steps: [], results: {}, summary }
        )
        // Resync steps after terminal updates so the canvas matches fold.
        void client.call("run/get", { id: runId }).then(
          (data) => applyGet(runId, data as RunGet),
          () => {}
        )
      }
    },
    [client, runId, applyGet]
  )

  useSubscription(runId ? `run:${runId}` : "run:__none__", onNotify)

  useEffect(() => {
    if (!runId || !steps) return
    for (const s of steps) {
      if (s.status !== "succeeded" && s.status !== "failed") continue
      const attempt = Math.max(1, s.attempts)
      const key = `${runId}:${s.nodeId}:${attempt}:${s.status}`
      if (fetched.current.has(key)) continue
      fetched.current.add(key)
      void fetchLog(
        client,
        runId,
        s.nodeId,
        attempt,
        s.status === "failed"
      ).then((text) => {
        if (!text) return
        setCache((prev) =>
          prev && prev.runId === runId
            ? {
                ...prev,
                results: { ...prev.results, [s.nodeId]: text },
              }
            : prev
        )
      })
    }
  }, [client, runId, steps])

  const views: Record<string, NodeView> = {}
  const results = active?.results ?? {}
  for (const [id, v] of Object.entries(statesFromSteps(steps ?? []))) {
    views[id] = {
      ...v,
      ...(results[id] ? { result: results[id] } : {}),
    }
  }

  const onRetry = useCallback(
    async (nodeId: string) => {
      if (!runId) return
      await retryStep(client, runId, nodeId)
    },
    [client, runId]
  )

  return {
    summary: active?.summary ?? null,
    views,
    onRetry: runId ? onRetry : undefined,
    runId,
    loading: !!runId && !active,
  }
}
