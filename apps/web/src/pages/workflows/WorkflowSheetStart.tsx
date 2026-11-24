import { Play } from "lucide-react"
import type { WireCardFace } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

type Props = {
  cards: WireCardFace[]
  cardId: string | null
  pending: boolean
  onCard: (id: string | null) => void
  onStart: () => void
}

/** Footer: pick a card and start a run of this workflow. */
export function WorkflowSheetStart({
  cards,
  cardId,
  pending,
  onCard,
  onStart,
}: Props) {
  return (
    <div className="flex items-center gap-2 border-t p-4">
      <Select
        value={cardId}
        items={cards.map((c) => ({ value: c.id, label: c.title }))}
        onValueChange={(v) => onCard(v)}
      >
        <SelectTrigger
          className="min-w-0 flex-1"
          data-testid="sheet-start-card"
        >
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
        disabled={!cardId || pending}
        onClick={onStart}
        className="shrink-0"
        data-testid="workflow-start"
      >
        <Play />
        Start run
      </Button>
    </div>
  )
}
