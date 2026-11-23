import { Play } from "lucide-react"
import { Panel } from "@xyflow/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { StatusPill } from "@/components/brand/StatusPill"
import { CARDS } from "./docket-data"
import type { MockRun } from "./workflows-data"

const cardTitle = (id: string) => CARDS.find((c) => c.id === id)?.title ?? id

type Props = {
  runs: MockRun[]
  value: string
  cardId: string | null
  onValue: (v: string) => void
  onCard: (v: string) => void
  onStart: () => void
}

/** Top of the canvas: switch between the draft and any run of this workflow. */
export function RunBar({ runs, value, cardId, onValue, onCard, onStart }: Props) {
  const run = runs.find((r) => r.id === value)
  const options = [
    { value: "draft", label: "Draft (editing)" },
    ...runs.map((r) => ({
      value: r.id,
      label: `#${r.attempt} · ${cardTitle(r.cardId)} · ${r.label}`,
    })),
  ]
  return (
    <Panel position="top-left">
      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-card p-2 ring-1 ring-foreground/10">
        <Select value={value} items={options} onValueChange={(v) => v && onValue(v)}>
          <SelectTrigger className="min-w-56" aria-label="Run" data-testid="flow-run-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {run ? null : (
          <>
            <Select
              value={cardId}
              items={CARDS.map((c) => ({ value: c.id, label: c.title }))}
              onValueChange={(v) => v && onCard(v)}
            >
              <SelectTrigger className="min-w-48" aria-label="Card">
                <SelectValue placeholder="Run for a card…" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {CARDS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!cardId} onClick={onStart} data-testid="flow-start-run">
              <Play />
              Start run
            </Button>
          </>
        )}
        {run ? (
        <div
          className="flex flex-wrap items-center gap-2 px-1 text-sm"
          data-testid="flow-run-banner"
        >
          <StatusPill tone={run.tone}>{run.label}</StatusPill>
          <span className="font-medium">{cardTitle(run.cardId)}</span>
          <span className="text-muted-foreground">
            #{run.attempt} · {run.reason} · {run.ago}
          </span>
          {Object.entries(run.inputs).map(([k, v]) => (
            <Badge key={k} variant="outline">
              {k}: {v}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground">Read-only</span>
        </div>
        ) : null}
      </div>
    </Panel>
  )
}
