import { Link } from "react-router"
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
import { RunStatusBadge } from "@/components/RunStatusBadge"
import { PageSection } from "@/components/page"
import { runPath } from "@/lib/paths"

type Props = {
  runs: RunSummary[]
}

export function RecentRunsSection({ runs }: Props) {
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
              size="sm"
              data-testid={`home-recent-${run.id}`}
            >
              <ItemContent>
                <ItemTitle>
                  <Button
                    variant="link"
                    className="h-auto p-0 font-mono"
                    render={<Link to={runPath(run.id)} />}
                  >
                    {run.id}
                  </Button>
                  <span className="text-muted-foreground">
                    {" "}
                    · {run.workflowName}
                  </span>
                </ItemTitle>
                <ItemDescription>
                  {run.finishedAt ?? run.startedAt}
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
