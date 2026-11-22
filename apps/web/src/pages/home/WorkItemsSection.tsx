import { Link } from "react-router"
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
import { workItemPath } from "@/lib/paths"
import type { HomeWorkItem } from "./home-work-items"

type Props = {
  items: HomeWorkItem[]
}

export function WorkItemsSection({ items }: Props) {
  return (
    <PageSection title="Work items">
      {items.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="home-work-items"
        >
          No work items with a recent run yet.
        </p>
      ) : (
        <ItemGroup data-testid="home-work-items">
          {items.map(({ item, run }) => (
            <Item
              key={item.id}
              variant="outline"
              size="sm"
              data-testid={`home-work-item-${item.id}`}
            >
              <ItemContent>
                <ItemTitle>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    render={<Link to={workItemPath(item.id)} />}
                  >
                    {item.title}
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
