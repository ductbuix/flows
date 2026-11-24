import { Play } from "lucide-react"
import { Panel } from "@xyflow/react"
import type { RunSummary, WireCardFace } from "@workspace/contracts"
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
import { RelativeTime } from "@/components/data/RelativeTime"
import { statusOf } from "@/components/runs/status"

type Props = {
  runs: RunSummary[]
  cards: WireCardFace[]
  value: string
  cardId: string | null
  onValue: (v: string) => void
  onCard: (v: string) => void
  onStart: () => void
  viewing: RunSummary | null
  starting?: boolean
}

/** Top of the canvas: draft vs a past or live run of this workflow. */
export function RunBar({
  runs,
  cards,
  value,
  cardId,
  onValue,
  onCard,
  onStart,
  viewing,
  starting,
}: Props) {
  const cardTitle = (id: string) => cards.find((c) => c.id === id)?.title ?? id
  const options = [
    { value: "draft", label: "Draft (editing)" },
    ...runs.map((r, i) => {
      const st = statusOf(r.status, r.needsYou.length > 0)
      const who = r.cardId ? cardTitle(r.cardId) : "No card"
      return {
        value: r.id,
        label: `#${runs.length - i} · ${who} · ${st.label}`,
      }
    }),
  ]
  return (
    <Panel position="top-right" className="m-2 max-w-4xl">
      <div
        className="flex flex-wrap items-center gap-2 rounded-3xl bg-card p-2 ring-1 ring-foreground/10"
        data-testid="flow-run-bar"
      >
        <Select
          value={value}
          items={options}
          onValueChange={(v) => v && onValue(v)}
        >
          <SelectTrigger
            className="min-w-56"
            aria-label="Run"
            data-testid="flow-run-select"
          >
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
        {viewing ? (
          <div
            className="flex flex-wrap items-center gap-2 px-1 text-sm"
            data-testid="flow-run-banner"
          >
            {(() => {
              const st = statusOf(viewing.status, viewing.needsYou.length > 0)
              return <StatusPill tone={st.tone}>{st.label}</StatusPill>
            })()}
            <span className="font-medium">
              {viewing.cardId ? cardTitle(viewing.cardId) : "No card"}
            </span>
            <span className="text-muted-foreground">
              {viewing.taskCounts.done}/{viewing.taskCounts.total} ·{" "}
              <RelativeTime value={viewing.startedAt} />
            </span>
            {viewing.itemKey ? (
              <Badge variant="outline">{viewing.itemKey}</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">Read-only</span>
          </div>
        ) : (
          <>
            <Select
              value={cardId}
              items={cards.map((c) => ({ value: c.id, label: c.title }))}
              onValueChange={(v) => v && onCard(v)}
            >
              <SelectTrigger
                className="min-w-48"
                aria-label="Card"
                data-testid="flow-run-card"
              >
                <SelectValue placeholder="Run for a card…" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!cardId || starting}
              onClick={onStart}
              data-testid="flow-start-run"
            >
              <Play />
              Start run
            </Button>
          </>
        )}
      </div>
    </Panel>
  )
}
