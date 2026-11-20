import { useEffect, useState } from "react"
import { summaryResponseSchema } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { api } from "@/lib/api"
import { SummaryMarkdown } from "./SummaryMarkdown"

type Props = {
  runId: string
  taskId: string
  attemptN: number
}

export function TaskDetailSummary({ runId, taskId, attemptN }: Props) {
  const slot = `${runId}:${taskId}:${attemptN}`
  const [state, setState] = useState<{
    slot: string
    missing: boolean
    text: string | null
  } | null>(null)

  const loading = state === null || state.slot !== slot

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.runs[":runId"].tasks[":taskId"].attempts[
        ":n"
      ].summary.$get({
        param: { runId, taskId, n: String(attemptN) },
      })
      if (!res.ok || !alive) return
      const summary = summaryResponseSchema.parse(await res.json())
      setState({
        slot,
        missing: summary.missing,
        text: summary.text,
      })
    })()
    return () => {
      alive = false
    }
  }, [runId, taskId, attemptN, slot])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading summary…</p>
  }

  if (state!.missing || !state!.text) {
    return (
      <Alert>
        <AlertTitle>SUMMARY.md missing</AlertTitle>
        <AlertDescription>
          This attempt has no summary file yet.
        </AlertDescription>
      </Alert>
    )
  }

  return <SummaryMarkdown text={state!.text} />
}
