import { Link } from "react-router"
import type { RunSummary } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { RunStatusBadge } from "@/components/RunStatusBadge"
import { Section } from "@/components/Section"
import { runPath } from "@/lib/paths"

type Props = {
  runs: RunSummary[]
}

export function RunningSection({ runs }: Props) {
  return (
    <Section title="Running">
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="home-running">
          Nothing running.
        </p>
      ) : (
        <ItemGroup data-testid="home-running">
          {runs.map((run) => {
            const { done, total } = run.taskCounts
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Item
                key={run.id}
                variant="outline"
                size="sm"
                data-testid={`home-running-${run.id}`}
              >
                <ItemContent className="gap-2">
                  <ItemTitle>
                    <Button
                      variant="link"
                      className="h-auto p-0 font-mono"
                      render={<Link to={runPath(run.id)} />}
                    >
                      {run.id}
                    </Button>
                    <span className="text-muted-foreground">
                      · {run.workflowName}
                    </span>
                  </ItemTitle>
                  <div className="flex items-center gap-3">
                    <RunStatusBadge
                      status={run.status}
                      needsYou={run.needsYou.length > 0}
                    />
                    <div
                      className="flex min-w-32 flex-1 items-center gap-2"
                      data-testid={`home-running-progress-${run.id}`}
                    >
                      <Progress value={pct} className="flex-1" />
                      <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                        {done}/{total}
                      </span>
                    </div>
                  </div>
                </ItemContent>
              </Item>
            )
          })}
        </ItemGroup>
      )}
    </Section>
  )
}
