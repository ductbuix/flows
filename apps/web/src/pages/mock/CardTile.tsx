import { CalendarDays, FileText, Link2 } from "lucide-react"
import { Card as UiCard, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { formatDate, type Card } from "./docket-data"
import { useLibrary } from "./library-store"
import { UserAvatar } from "./UserAvatar"

type TileProps = {
  card: Card
  dragging: boolean
  showDrop: boolean
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => void
  onDrop: () => void
}

export function CardTile({
  card,
  dragging,
  showDrop,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TileProps) {
  const assignee = card.fields.assignee
  const assets = useLibrary().filter((i) => i.usedBy.includes(card.id)).length
  return (
    <>
      {showDrop ? <div className="h-0.5 rounded-full bg-ring" /> : null}
      <UiCard
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move"
          onDragStart()
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragOver()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDrop()
        }}
        role="button"
        tabIndex={0}
        className={cn(
          "@container/card cursor-grab transition-shadow outline-none ring-inset hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing active:ring-foreground/40",
          dragging && "opacity-40"
        )}
        data-testid={`docket-card-${card.id}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpen()
        }}
      >
        <CardContent className="flex flex-col gap-3">
          <div className="line-clamp-2 text-sm font-medium break-words">
            {card.title}
          </div>
          <div className="flex min-h-6 items-center gap-3 text-xs text-muted-foreground">
            {card.due ? (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDate(card.due)}
              </span>
            ) : null}
            {assets ? (
              <span className="flex items-center gap-1">
                <FileText className="size-3.5" />
                {assets}
              </span>
            ) : null}
            {card.links.length ? (
              <span className="flex items-center gap-1">
                <Link2 className="size-3.5" />
                {card.links.length}
              </span>
            ) : null}
            {assignee ? <UserAvatar name={assignee} /> : null}
          </div>
        </CardContent>
      </UiCard>
    </>
  )
}
