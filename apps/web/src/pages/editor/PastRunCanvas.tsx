import { useCallback, useEffect, useState } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { ArrowLeftIcon } from "lucide-react"
import { runDetailSchema, type RunDetail } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/lib/api"
import { useRunSocket } from "@/pages/run-view/useRunSocket"
import { NodeRunGraph } from "@/pages/run-view/NodeRunGraph"

const noSelect = () => {}

/** A past run as it saw the canvas: frozen graph and layout, read-only (BL-103). */
export function PastRunCanvas({
  runId,
  onBack,
}: {
  runId: string
  onBack: () => void
}) {
  const [run, setRun] = useState<RunDetail | null>(null)
  const apply = useCallback((next: RunDetail) => {
    setRun((prev) =>
      prev && prev.id === next.id && prev.lastSeq > next.lastSeq ? prev : next
    )
  }, [])

  useEffect(() => {
    let alive = true
    setRun(null)
    void (async () => {
      const res = await api.runs[":runId"].$get({ param: { runId } })
      if (alive && res.ok) apply(runDetailSchema.parse(await res.json()))
    })()
    return () => {
      alive = false
    }
  }, [runId, apply])

  useRunSocket(runId, run, apply)

  return (
    <div className="flex h-full flex-col" data-testid="past-run">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="back-to-editing"
          onClick={onBack}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to editing
        </Button>
        <span className="text-sm text-muted-foreground">
          Viewing a past run, read-only. The graph is as that run saw it.
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {run ? (
          <ReactFlowProvider>
            <NodeRunGraph run={run} onSelectTask={noSelect} />
          </ReactFlowProvider>
        ) : null}
      </div>
    </div>
  )
}
