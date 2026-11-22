import { Link } from "react-router"
import { RelativeTime } from "@/components/data/RelativeTime"
import { useLabels } from "@/hooks/use-labels"
import type { RunSummary } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { RunStatusBadge } from "@/components/data/RunStatusBadge"
import { PageSection } from "@/components/page"
import { runPath } from "@/lib/paths"

type Props = {
  runs: RunSummary[]
}

export function RecentRunsSection({ runs }: Props) {
  const { workflowLabelFor, runLabelFor } = useLabels()
  return (
    <PageSection title="Recent runs">
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="home-recent">
          No finished runs yet.
        </p>
      ) : (
        <ItemGroup data-testid="home-recent">
          {runs.map((run) => (
            <Item
              key={run.id}
              variant="outline"
              data-testid={`home-recent-${run.id}`}
            >
              <ItemContent>
                <ItemTitle>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    render={<Link to={runPath(run.id)} />}
                  >
                    {runLabelFor(run)}
                  </Button>
                  <span className="text-muted-foreground">
                    {" "}
                    · {workflowLabelFor(run.workflowId)}
                  </span>
                </ItemTitle>
                <ItemDescription>
                  <RelativeTime value={run.finishedAt ?? run.startedAt} />
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <RunStatusBadge
                  status={run.status}
                  needsYou={run.needsYou.length > 0}
                />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </PageSection>
  )
}
