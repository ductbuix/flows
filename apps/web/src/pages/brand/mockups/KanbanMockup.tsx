import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@workspace/ui/components/item"
import { cn } from "@workspace/ui/lib/utils"
import { Plus } from "lucide-react"
import { StatusPill } from "@/components/brand/StatusPill"
import type { Mockup } from "../types"
import { COLUMNS, type BoardCard } from "./kanban-data"

function BoardItem({ card }: { card: BoardCard }) {
  return (
    <Item
      variant="outline"
      className={cn(
        "cursor-grab bg-background",
        card.status?.tone === "attention" && "ring-warning/50"
      )}
      data-testid="kanban-card"
    >
      <ItemContent>
        <ItemTitle>{card.title}</ItemTitle>
        <ItemDescription>{card.source}</ItemDescription>
      </ItemContent>
      {card.workflow || card.status ? (
        <ItemFooter>
          <span className="truncate text-xs text-muted-foreground">
            {card.workflow}
          </span>
          {card.status ? (
            <StatusPill tone={card.status.tone}>{card.status.label}</StatusPill>
          ) : null}
        </ItemFooter>
      ) : null}
    </Item>
  )
}

/** Work items as a board: four columns, cards move left to right. */
export function KanbanMockup() {
  return (
    <div
      className="flex w-full max-w-5xl gap-3 overflow-x-auto pb-2"
      data-testid="mockup-kanban"
    >
      {COLUMNS.map((col) => (
        <div
          key={col.title}
          className="flex w-64 shrink-0 flex-col gap-2 rounded-2xl bg-muted p-2 dark:bg-card"
        >
          <div className="flex items-center gap-2 px-1.5 pt-1">
            <span className="text-sm font-medium">{col.title}</span>
            <Badge variant="secondary">{col.cards.length}</Badge>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Add to ${col.title}`}
            >
              <Plus />
            </Button>
          </div>
          {col.cards.map((card) => (
            <BoardItem key={card.title} card={card} />
          ))}
        </div>
      ))}
    </div>
  )
}

export const kanbanMockup: Mockup = {
  id: "kanban",
  title: "Work items board",
  group: "Work items",
  summary:
    "The Work items page: a Kanban board with Inbox, Running, Needs you and Done.",
  usedIn: ["/docket (the page itself)"],
  anatomy: [
    "Page header: title, one line, New work item button",
    "Lane: muted rounded-2xl column (no shadcn part), name, count Badge, ghost + Button",
    "Card: Item variant=outline (ring-only): ItemTitle, ItemDescription (source line), ItemFooter with workflow + status pill",
  ],
  states: [
    "Inbox: no workflow yet, no pill",
    "Running: info pill with the live step (Step 2 of 4)",
    "Needs you: warning ring + attention pill (Approve publish, Needs sign-in)",
    "Done: success pill; Failed stays in Running with a failed pill",
    "Empty column: lane stays, a muted line says what lands here",
  ],
  rules: {
    do: [
      "Column is derived from the latest run; drag only between Inbox and Done",
      "Open the item in a right Sheet on click; keep the board in view",
      "Fixed lane width (w-64), board scrolls sideways",
      "One status pill per card, at the bottom right",
    ],
    dont: [
      "Tables for work items on this page",
      "Ids, paths or timestamps in ISO form on cards",
      "More than three lines of text on a card",
    ],
  },
  parts: [
    "ui Item (Content, Title, Description, Footer), ui Badge",
    "components/brand/StatusPill",
    "ui Button ghost icon, ui Sheet for the item detail",
  ],
  Component: KanbanMockup,
}
