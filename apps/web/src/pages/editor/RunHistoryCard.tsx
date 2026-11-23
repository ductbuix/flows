import { HistoryIcon } from "lucide-react"
import { useRunsList } from "@/hooks/use-runs-list"
import { useLabels } from "@/hooks/use-labels"
import { RelativeTime } from "@/components/data/RelativeTime"
import { RunStatusBadge } from "@/components/data/RunStatusBadge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"

const SHOWN = 6

/** Recent runs in the canvas corner; picking one opens it read-only (BL-103). */
export function RunHistoryCard({
  workflowId,
  pickedId,
  onPick,
}: {
  workflowId: string
  pickedId: string | null
  onPick: (runId: string) => void
}) {
  const { runs } = useRunsList({ workflowId })
  const { runLabelFor } = useLabels()
  const recent = runs?.slice(0, SHOWN) ?? []
  return (
    <Card
      className="absolute right-3 bottom-3 z-10 w-72 gap-2"
      data-testid="run-history"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <HistoryIcon className="size-4" />
          Run history
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="run-history-empty"
          >
            {runs ? "No runs yet" : "Loading runs"}
          </p>
        ) : (
          <ItemGroup>
            {recent.map((run) => (
              <Item
                key={run.id}
                variant={run.id === pickedId ? "muted" : "outline"}
                render={<button type="button" />}
                data-testid={`run-history-${run.id}`}
                aria-pressed={run.id === pickedId}
                onClick={() => onPick(run.id)}
              >
                <ItemContent>
                  <ItemTitle>{runLabelFor(run)}</ItemTitle>
                  <RelativeTime
                    value={run.startedAt}
                    className="text-xs text-muted-foreground"
                  />
                </ItemContent>
                <ItemActions>
                  <RunStatusBadge
                    status={run.status}
                    needsYou={run.needsYou.length > 0}
                    data-testid={`run-history-status-${run.id}`}
                  />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}
