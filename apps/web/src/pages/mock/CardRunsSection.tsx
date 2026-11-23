import { useState } from "react"
import { Play } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { StatusPill } from "@/components/brand/StatusPill"
import type { Card } from "./docket-data"
import { RunWorkflowDialog } from "./RunWorkflowDialog"
import { EmptyLine, Section } from "./SectionParts"
import { useRuns } from "./runs-store"
import { useWorkflows } from "./workflows-store"

/** Runs of any workflow for this card; a row opens that run on the canvas. */
export function CardRunsSection({ card }: { card: Card }) {
  const workflows = useWorkflows()
  const runs = useRuns().filter((r) => r.cardId === card.id)
  const [running, setRunning] = useState(false)
  return (
    <Section title="Runs">
      {runs.length === 0 ? (
        <EmptyLine>No runs yet</EmptyLine>
      ) : (
        runs.map((r) => (
          <Link
            key={r.id}
            to={`/mock/workflows/${r.workflowId}?run=${r.id}`}
            className="-mx-2 flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
          >
            <StatusPill tone={r.tone}>{r.label}</StatusPill>
            <span className="min-w-0 flex-1 truncate">
              {workflows.find((w) => w.id === r.workflowId)?.name}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              #{r.attempt} · {r.ago}
            </span>
          </Link>
        ))
      )}
      <Button
        variant="ghost"
        className="-mx-2 w-fit justify-start px-2 text-muted-foreground"
        onClick={() => setRunning(true)}
        data-testid="card-run-open"
      >
        <Play />
        Run workflow
      </Button>
      <RunWorkflowDialog card={card} open={running} onOpenChange={setRunning} />
    </Section>
  )
}
