import { useEffect, useState } from "react"
import { Link } from "react-router"
import type { RunDetail } from "@workspace/shared"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { formatDuration } from "@/lib/labels"
import { workItemPath } from "@/lib/paths"
import { RunInputFiles } from "./RunInputFiles"

const VALUE = "text-2xl font-semibold tabular-nums"

/** Elapsed time of a run; ticks every second while it is live. */
export function useRunDuration(run: RunDetail): number {
  const live = run.finishedAt === undefined
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [live])
  const start = Date.parse(run.startedAt)
  const end = run.finishedAt ? Date.parse(run.finishedAt) : now
  return Math.max(0, end - start)
}

type Props = {
  run: RunDetail
  workItemTitle?: string
}

/** Four summary Cards above the tabs (DES-029 Run view). */
export function RunSummaryCards({ run, workItemTitle }: Props) {
  const { total, finished } = run.taskCounts
  const pct = total > 0 ? Math.round((finished / total) * 100) : 0
  const duration = useRunDuration(run)

  return (
    <div
      className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4"
      data-testid="run-summary-cards"
    >
      <Card>
        <CardHeader>
          <CardDescription>Tasks</CardDescription>
          <CardTitle className={VALUE}>
            {finished} of {total}
          </CardTitle>
        </CardHeader>
        <div className="px-(--card-spacing)" data-testid="run-progress">
          <Progress value={pct} />
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Duration</CardDescription>
          <CardTitle className={VALUE} data-testid="run-duration">
            {formatDuration(duration)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Work item</CardDescription>
          <CardTitle className="truncate text-base">
            {run.workItemId ? (
              <Link
                to={workItemPath(run.workItemId)}
                className="underline-offset-2 hover:underline"
                data-testid="run-work-item"
              >
                {workItemTitle ?? run.workItemId}
              </Link>
            ) : (
              <span className="font-normal text-muted-foreground">None</span>
            )}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Inputs</CardDescription>
          <RunInputFiles runId={run.id} files={run.inputFiles} />
        </CardHeader>
      </Card>
    </div>
  )
}
