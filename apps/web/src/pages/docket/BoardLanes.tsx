import { Inbox, Plus } from "lucide-react"
import type { WireCardFace } from "@workspace/contracts"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { CardTile } from "./CardTile"
import { ColumnHeader, LANE_BG } from "./ColumnHeader"
import type { UiColumn } from "./column-tone"

type Props = {
  columns: UiColumn[]
  cards: WireCardFace[]
  dragId: string | null
  overCol: string | null
  overCard: string | null
  onOpen: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onOverCol: (colId: string) => void
  onOverCard: (colId: string, cardId: string) => void
  onDropCol: (colId: string) => void
  onDropCard: (colId: string, beforeId: string) => void
  onAdd: (colId: string) => void
}

export function BoardLanes({
  columns,
  cards,
  dragId,
  overCol,
  overCard,
  onOpen,
  onDragStart,
  onDragEnd,
  onOverCol,
  onOverCard,
  onDropCol,
  onDropCard,
  onAdd,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto">
      {columns.map((col) => {
        const colCards = cards.filter((c) => c.status === col.id)
        return (
          <section
            key={col.id}
            className={cn(
              "flex max-h-full w-72 shrink-0 snap-start flex-col gap-2.5 overflow-hidden rounded-3xl p-2.5",
              LANE_BG[col.tone],
              dragId && overCol === col.id && "ring-2 ring-ring ring-inset"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              onOverCol(col.id)
            }}
            onDrop={(e) => {
              e.preventDefault()
              onDropCol(col.id)
            }}
            data-testid={`docket-column-${col.id}`}
          >
            <ColumnHeader col={col} count={colCards.length} />
            <div
              className="flex min-h-0 flex-col gap-2.5 overflow-y-auto"
              data-testid={`docket-scroll-${col.id}`}
            >
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
                  onOpen={() => onOpen(card.id)}
                  onDragStart={() => onDragStart(card.id)}
                  onDragEnd={onDragEnd}
                  onDragOver={() => onOverCard(col.id, card.id)}
                  onDrop={() => onDropCard(col.id, card.id)}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              className="shrink-0 justify-start text-muted-foreground"
              data-testid={`docket-add-${col.id}`}
              onClick={() => onAdd(col.id)}
            >
              <Plus />
              Add card
            </Button>
          </section>
        )
      })}
    </div>
  )
}
