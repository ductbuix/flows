import { useState } from "react"
import { useSearchParams } from "react-router"
import { Columns3, Inbox, Plus } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Page, PageTitle } from "@/components/page"
import { NewCardDialog } from "./NewCardDialog"
import { CardPanel } from "./CardPanel"
import { CardTile } from "./CardTile"
import { ColumnsDialog } from "./ColumnsDialog"
import { saveColumns, useColumns } from "./columns-store"
import { ColumnHeader, LANE_BG } from "./ColumnHeader"
import { CARDS as INITIAL_CARDS, type Card } from "./docket-data"

export function DocketPage() {
  const columns = useColumns()
  const [editingCols, setEditingCols] = useState(false)
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get("card"))
  const [cards, setCards] = useState<Card[]>(INITIAL_CARDS)
  const [creating, setCreating] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [overCard, setOverCard] = useState<string | null>(null)

  function move(status: string, beforeId: string | null) {
    if (!dragId || dragId === beforeId) return
    setCards((prev) => {
      const moved = prev.find((c) => c.id === dragId)
      if (!moved) return prev
      const rest = prev.filter((c) => c.id !== dragId)
      const next = { ...moved, status }
      const at = beforeId ? rest.findIndex((c) => c.id === beforeId) : -1
      if (at < 0) return [...rest, next]
      return [...rest.slice(0, at), next, ...rest.slice(at)]
    })
  }

  function endDrag() {
    setDragId(null)
    setOverCol(null)
    setOverCard(null)
  }

  const open = cards.find((c) => c.id === openId) ?? null

  return (
    <Page
      fill
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Docket" }]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setEditingCols(true)}
            data-testid="docket-columns-open"
          >
            <Columns3 />
            Columns
          </Button>
          <Button
            onClick={() => setCreating(columns[0]?.id ?? null)}
            data-testid="docket-new-card-open"
          >
            <Plus />
            New card
          </Button>
        </div>
      }
      data-testid="docket-page"
    >
      <PageTitle
        title="Docket"
        description="Cards wrap tickets, files and notes. Mock data."
      />
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto">
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.status === col.id)
          return (
            <section
              key={col.id}
              className={cn(
                "flex max-h-full w-72 shrink-0 snap-start flex-col gap-2.5 overflow-y-auto rounded-3xl p-2.5",
                LANE_BG[col.tone],
                dragId && overCol === col.id && "ring-2 ring-ring ring-inset"
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(col.id)
                setOverCard(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                move(col.id, null)
                endDrag()
              }}
              data-testid={`docket-column-${col.id}`}
            >
              <ColumnHeader col={col} count={colCards.length} />
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
                    <EmptyDescription>
                      {dragId ? "Drop here" : `Drag a card to ${col.label}`}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {colCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  dragging={dragId === card.id}
                  showDrop={
                    !!dragId && overCard === card.id && dragId !== card.id
                  }
                  onOpen={() => setOpenId(card.id)}
                  onDragStart={() => setDragId(card.id)}
                  onDragEnd={endDrag}
                  onDragOver={() => {
                    setOverCol(col.id)
                    setOverCard(card.id)
                  }}
                  onDrop={() => {
                    move(col.id, card.id)
                    endDrag()
                  }}
                />
              ))}
              <Button
                variant="ghost"
                className="justify-start text-muted-foreground"
                data-testid={`docket-add-${col.id}`}
                onClick={() => setCreating(col.id)}
              >
                <Plus />
                Add card
              </Button>
            </section>
          )
        })}
      </div>
      <ColumnsDialog
        open={editingCols}
        columns={columns}
        cards={cards}
        onOpenChange={setEditingCols}
        onSave={(next, moves) => {
          saveColumns(next)
          setCards((prev) =>
            prev.map((c) =>
              moves[c.status] ? { ...c, status: moves[c.status]! } : c
            )
          )
        }}
      />
      <NewCardDialog
        open={creating !== null}
        defaultStatus={creating ?? columns[0]?.id ?? ""}
        existingIds={cards.map((c) => c.id)}
        onOpenChange={(o) => !o && setCreating(null)}
        onCreate={(card) => {
          setCards((prev) => [...prev, card])
          setOpenId(card.id)
        }}
      />
      <CardPanel
        card={open}
        allCards={cards}
        onChange={(next) =>
          setCards((prev) => prev.map((c) => (c.id === next.id ? next : c)))
        }
        onDelete={(id) => {
          setCards((prev) => prev.filter((c) => c.id !== id))
          setOpenId(null)
        }}
        onClose={() => setOpenId(null)}
      />
    </Page>
  )
}
