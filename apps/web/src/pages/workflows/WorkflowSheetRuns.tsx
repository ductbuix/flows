import { Link } from "react-router"
import type { RunSummary, WireCardFace } from "@workspace/contracts"
import { StatusPill } from "@/components/brand/StatusPill"
import { RelativeTime } from "@/components/data/RelativeTime"
import { statusOf } from "@/components/runs/status"

type Group = { card: WireCardFace | null; cardId: string; runs: RunSummary[] }

function groupByCard(runs: RunSummary[], cards: WireCardFace[]): Group[] {
  const byId = new Map<string, WireCardFace>()
  for (const c of cards) byId.set(c.id, c)
  const groups = new Map<string, Group>()
  for (const r of runs) {
    const cardId = r.cardId ?? "_none"
    let g = groups.get(cardId)
    if (!g) {
      g = {
        cardId,
        card: byId.get(cardId) ?? null,
        runs: [],
      }
      groups.set(cardId, g)
    }
    g.runs.push(r)
  }
  return [...groups.values()]
}

type Props = {
  workflowId: string
  runs: RunSummary[]
  cards: WireCardFace[]
}

/** Runs of this workflow, grouped by the card that started them. */
export function WorkflowSheetRuns({ workflowId, runs, cards }: Props) {
  const byCard = groupByCard(runs, cards)
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-medium">
        Runs by card
        <span className="ml-2 text-muted-foreground">
          {byCard.length} cards · {runs.length} runs
        </span>
      </h3>
      {byCard.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="sheet-runs-empty"
        >
          No runs yet
        </p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="sheet-runs-list">
          {byCard.map(({ card, cardId, runs: rs }) => (
            <div key={cardId} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {card?.title ?? (cardId === "_none" ? "No card" : cardId)}
              </span>
              {rs.map((r, i) => {
                const st = statusOf(r.status, r.needsYou.length > 0)
                return (
                  <Link
                    key={r.id}
                    to={`/workflows/${workflowId}?run=${r.id}`}
                    className="-mx-2 flex min-h-8 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
                    data-testid={`sheet-run-row-${r.id}`}
                  >
                    <span className="w-6 text-xs text-muted-foreground tabular-nums">
                      #{rs.length - i}
                    </span>
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    <span className="flex-1 truncate text-muted-foreground">
                      {r.taskCounts.done}/{r.taskCounts.total} ·{" "}
                      <RelativeTime value={r.startedAt} />
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
