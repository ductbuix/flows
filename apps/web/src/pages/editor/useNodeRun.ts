import { useCallback, useEffect, useRef, useState } from "react"
import {
  logChunkSchema,
  runDetailSchema,
  type RunDetail,
} from "@workspace/shared"
import { api } from "@/lib/api"
import { useRunSocket } from "@/pages/run-view/useRunSocket"
import {
  formatElapsed,
  isLive,
  nodeStatus,
  passesOf,
  trackTimes,
  verdictsOf,
  type NodeRunView,
  type StepTimes,
} from "./node-run"

const RESULT_MAX = 600

async function fetchResult(
  runId: string,
  taskId: string,
  attempt: number,
  failed: boolean
): Promise<string> {
  for (const stream of failed
    ? (["stderr", "stdout"] as const)
    : (["stdout"] as const)) {
    const res = await api.runs[":runId"].tasks[":taskId"].attempts[
      ":n"
    ].log.$get({
      param: { runId, taskId, n: String(attempt) },
      query: { stream, offset: "0" },
    })
    if (!res.ok) continue
    const text = logChunkSchema.parse(await res.json()).text.trim()
    if (text)
      return text.length > RESULT_MAX ? `${text.slice(0, RESULT_MAX)}…` : text
  }
  return ""
}

/** Follows one run over the websocket and maps it onto node cards (BL-086). */
export function useNodeRun() {
  const [runId, setRunId] = useState<string>()
  const [run, setRun] = useState<RunDetail | null>(null)
  const [results, setResults] = useState<Record<string, string>>({})
  const [now, setNow] = useState(() => Date.now())
  const [times, setTimes] = useState<StepTimes>({})
  const fetched = useRef(new Set<string>())

  const apply = useCallback((next: RunDetail) => {
    setRun((prev) =>
      prev && prev.id === next.id && prev.lastSeq > next.lastSeq ? prev : next
    )
    const at = Date.now()
    setTimes((prev) => trackTimes(prev, next, at))
    for (const t of next.tasks) {
      const last = t.attempts.at(-1)
      if (!last || (t.status !== "succeeded" && t.status !== "failed")) continue
      const key = `${next.id}:${t.id}:${last.attempt}:${t.status}`
      if (fetched.current.has(key)) continue
      fetched.current.add(key)
      void fetchResult(next.id, t.id, last.attempt, t.status === "failed").then(
        (text) => setResults((r) => ({ ...r, [t.id]: text }))
      )
    }
  }, [])

  const follow = useCallback((id: string) => {
    setTimes({})
    fetched.current.clear()
    setResults({})
    setRun(null)
    setRunId(id)
  }, [])

  useEffect(() => {
    if (!runId) return
    let alive = true
    void (async () => {
      const res = await api.runs[":runId"].$get({ param: { runId } })
      if (alive && res.ok) apply(runDetailSchema.parse(await res.json()))
    })()
    return () => {
      alive = false
    }
  }, [runId, apply])

  useRunSocket(runId, run, apply)

  const live = isLive(run)
  const ticking = live || run?.tasks.some((t) => t.status === "running")
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [ticking])

  const views: Record<string, NodeRunView> = {}
  const verdicts = verdictsOf(run?.steps)
  const passes = passesOf(run?.steps)
  for (const t of run?.tasks ?? []) {
    const status = nodeStatus(t.status)
    if (!status) continue
    const span = times[t.id]
    views[t.id] = {
      status,
      ...(span ? { timer: formatElapsed((span.end ?? now) - span.start) } : {}),
      ...(results[t.id] ? { result: results[t.id] } : {}),
      ...(verdicts[t.id] ? { verdict: verdicts[t.id] } : {}),
      ...(passes[t.id] ? { pass: passes[t.id] } : {}),
    }
  }
  return { runId, run, live, views, follow }
}
