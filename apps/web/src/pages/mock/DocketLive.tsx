import { useQuery } from "@workspace/sdk-react"
import { Inbox } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Page, PageTitle } from "@/components/page"
import { ColumnHeader, LANE_BG } from "./ColumnHeader"
import { cn } from "@workspace/ui/lib/utils"

const TONE = ["idle", "working", "attention", "done"] as const

/** Docket board fed by FCP over the app transport (Electron MessagePort or ws). */
export function DocketLive() {
  const board = useQuery("docket/get_board", {}, { topics: ["docket"] })
  const cards = useQuery("docket/list_cards", {}, { topics: ["docket"] })

  const columns = board.data?.board?.columns ?? []
  const items = cards.data?.items ?? []
  const loading = board.loading || cards.loading
  const error = board.error ?? cards.error

  return (
    <Page fill crumbs={[{ label: "Docket" }]} data-testid="docket-page">
      <PageTitle
        title="Docket"
        description={
          loading
            ? "Loading cards…"
            : error
              ? "Could not load cards."
              : "Cards from the local engine."
        }
      />
      {error ? (
        <p className="text-destructive" data-testid="docket-error">
          {error instanceof Error ? error.message : "Failed to load Docket"}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto">
        {columns.map((col, i) => {
          const colCards = items.filter((c) => c.status === col.id)
          const tone = TONE[i % TONE.length]!
          return (
            <section
              key={col.id}
              className={cn(
                "flex max-h-full w-72 shrink-0 snap-start flex-col gap-2.5 overflow-y-auto rounded-3xl p-2.5",
                LANE_BG[tone]
              )}
              data-testid={`docket-column-${col.id}`}
            >
              <ColumnHeader
                col={{ id: col.id, label: col.label, tone }}
                count={colCards.length}
              />
              {colCards.length === 0 ? (
                <Empty
                  className="ring-1 ring-foreground/10"
                  data-testid={`docket-empty-${col.id}`}
                >
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox />
                    </EmptyMedia>
                    <EmptyTitle>No cards</EmptyTitle>
                    <EmptyDescription>Empty column</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {colCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10"
                  data-testid={`docket-card-${card.id}`}
                >
                  <div className="text-sm font-medium">{card.title}</div>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </Page>
  )
}
