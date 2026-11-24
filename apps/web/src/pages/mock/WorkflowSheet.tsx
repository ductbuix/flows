import { useState } from "react"
import { Play, Workflow } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { StatusPill } from "@/components/brand/StatusPill"
import type { Card } from "./docket-data"
import type { MockRun, MockWorkflow } from "./workflows-data"

type Props = {
  workflow: MockWorkflow | null
  runs: MockRun[]
  cards: Card[]
  onStart: (workflowId: string, cardId: string) => void
  onClose: () => void
}

export function WorkflowSheet({
  workflow,
  runs,
  cards,
  onStart,
  onClose,
}: Props) {
  const [cardId, setCardId] = useState<string | null>(null)
  const mine = runs.filter((r) => r.workflowId === workflow?.id)
  const byCard = cards
    .map((c) => ({ card: c, runs: mine.filter((r) => r.cardId === c.id) }))
    .filter((g) => g.runs.length > 0)

  return (
    <Sheet open={!!workflow} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="workflow-sheet"
      >
        {workflow ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>{workflow.name}</SheetTitle>
              <SheetDescription>
                {workflow.id} · Solves: {workflow.solves}
              </SheetDescription>
              <Button
                variant="outline"
                className="mt-2 w-fit"
                nativeButton={false}
                render={<Link to={`/mock/workflows/${workflow.id}`} />}
                data-testid="workflow-open-editor"
              >
                <Workflow />
                Open editor
              </Button>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t p-4">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Inputs a card supplies</h3>
                <div className="flex flex-wrap gap-1.5">
                  {workflow.inputs.map((i) => (
                    <Badge key={i} variant="outline">
                      {i}
                    </Badge>
                  ))}
                </div>
              </section>
              <section className="flex flex-col gap-3 border-t pt-4">
                <h3 className="text-sm font-medium">
                  Runs by card
                  <span className="ml-2 text-muted-foreground">
                    {byCard.length} cards · {mine.length} runs
                  </span>
                </h3>
                {byCard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs yet</p>
                ) : (
                  byCard.map(({ card, runs: rs }) => (
                    <div key={card.id} className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{card.title}</span>
                      {rs.map((r) => (
                        <Link
                          key={r.id}
                          to={`/mock/workflows/${workflow.id}?run=${r.id}`}
                          className="-mx-2 flex min-h-8 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
                        >
                          <span className="w-6 text-xs text-muted-foreground tabular-nums">
                            #{r.attempt}
                          </span>
                          <StatusPill tone={r.tone}>{r.label}</StatusPill>
                          <span className="flex-1 truncate text-muted-foreground">
                            {r.reason} · {r.ago}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {r.duration}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))
                )}
              </section>
            </div>
            <div className="flex items-center gap-2 border-t p-4">
              <Select
                value={cardId}
                items={cards.map((c) => ({ value: c.id, label: c.title }))}
                onValueChange={(v) => setCardId(v)}
              >
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue placeholder="Run for a card…" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!cardId}
                onClick={() => cardId && onStart(workflow.id, cardId)}
                className="shrink-0"
                data-testid="workflow-start"
              >
                <Play />
                Start run
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
