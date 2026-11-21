import type { RunDetail } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { RunStatusBadge } from "@/components/RunStatusBadge"
import type { RunBodyView } from "./useSearchView"
import type { WsConnectionState } from "./useRunSocket"
import { RunControls } from "./RunControls"
import { RunInputFiles } from "./RunInputFiles"

type Props = {
  run: RunDetail
  view: RunBodyView
  onViewChange: (view: RunBodyView) => void
  wsState: WsConnectionState
  stale: boolean
}

export function RunHeader({ run, view, onViewChange, wsState, stale }: Props) {
  const { total, finished } = run.taskCounts
  const pct = total > 0 ? Math.round((finished / total) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      {stale && (
        <Alert variant="destructive">
          <AlertTitle>Live updates paused</AlertTitle>
          <AlertDescription>
            Websocket disconnected. Data may be stale until you reload.
          </AlertDescription>
        </Alert>
      )}

      <RunControls run={run} />

      <RunInputFiles runId={run.id} files={run.inputFiles} />

      <div className="flex flex-wrap items-center gap-3">
        <RunStatusBadge status={run.status} />
        <div
          className="flex min-w-40 flex-1 items-center gap-2"
          data-testid="run-progress"
        >
          <Progress value={pct} className="flex-1" />
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {finished}/{total}
          </span>
        </div>
        {!run.sandboxed && (
          <Badge
            data-testid="sandbox-badge"
            variant="destructive"
            title="Run is not sandboxed"
          >
            not sandboxed
          </Badge>
        )}
        <ToggleGroup
          value={[view]}
          onValueChange={(v) => {
            const next = v[0]
            if (next === "list" || next === "graph") onViewChange(next)
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="list" data-testid="run-view-list">
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="graph" data-testid="run-view-graph">
            Graph
          </ToggleGroupItem>
        </ToggleGroup>
        <span data-testid="ws-status" className="text-sm text-muted-foreground">
          ws: {wsState}
        </span>
      </div>
    </div>
  )
}
