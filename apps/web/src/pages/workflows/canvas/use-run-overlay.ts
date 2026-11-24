import { useMemo, useState } from "react"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import { startRun } from "@/pages/runs/run-actions"
import type { CanvasNode } from "./flow-graph"
import { useCanvasRun } from "./use-canvas-run"

/** Run list, card picker, start, and node status overlay for the canvas. */
export function useRunOverlay(
  workflowId: string,
  nodes: CanvasNode[],
  view: string,
  setView: (v: string) => void
) {
  const client = useFlowsClient()
  const runsQ = useQuery(
    "run/list",
    { workflowId, limit: 100 },
    { topics: ["run"] }
  )
  const cardsQ = useQuery("docket/list_cards", {}, { topics: ["docket"] })
  const [cardId, setCardId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const runs = runsQ.data?.items ?? []
  const cards = cardsQ.data?.items ?? []
  const runId = view === "draft" ? null : view
  const { summary, views, onRetry } = useCanvasRun(runId)
  const viewing = summary ?? runs.find((r) => r.id === runId) ?? null

  const shown = useMemo(() => {
    if (!runId) return nodes
    return nodes.map((n) => {
      const v = views[n.id]
      // Keep pointer events when Retry is offered on a failed node.
      const interactive = v?.state === "failed"
      return {
        ...n,
        className: interactive ? undefined : "pointer-events-none",
        selectable: false,
        draggable: false,
        data: {
          ...n.data,
          ...(v?.state ? { state: v.state } : {}),
          ...(v?.result ? { result: v.result } : {}),
        },
      }
    })
  }, [nodes, runId, views])

  async function start() {
    if (!cardId) return
    setStarting(true)
    const result = await startRun(client, {
      workflowId,
      workItemId: cardId,
    })
    setStarting(false)
    if (result.ok && result.runId) setView(result.runId)
  }

  return {
    shown,
    runs,
    cards,
    cardId,
    setCardId,
    viewing,
    starting,
    start,
    onRetry,
    readOnly: !!runId,
  }
}
