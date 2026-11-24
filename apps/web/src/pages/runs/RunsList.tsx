import type { RunSummary } from "@workspace/contracts"
import { StatusPill } from "@/components/brand/StatusPill"
import { RelativeTime } from "@/components/data/RelativeTime"
import { mono } from "@/components/data/mono"
import { statusOf } from "./status"

export function RunsList({
  runs,
  onPick,
}: {
  runs: RunSummary[]
  onPick: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-0.5" data-testid="runs-list">
      {runs.map((r) => {
        const st = statusOf(r.status, r.needsYou.length > 0)
        return (
          <button
            key={r.id}
            type="button"
            className="-mx-2 flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
            data-testid={`runs-row-${r.id}`}
            onClick={() => onPick(r.id)}
          >
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
            <span className="min-w-0 flex-1 truncate font-medium">
              {r.workflowName || r.workflowId}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {r.taskCounts.done}/{r.taskCounts.total}
            </span>
            <span className="text-xs text-muted-foreground">
              <RelativeTime value={r.startedAt} />
            </span>
            <span className={`${mono} text-xs text-muted-foreground`}>
              {r.id.slice(0, 8)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
