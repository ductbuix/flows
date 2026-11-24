import { Sheet, SheetContent } from "@workspace/ui/components/sheet"
import { CardPanelBody } from "./CardPanelBody"

type Props = {
  cardId: string | null
  onClose: () => void
  onDeleted: () => void
}

export function CardPanel({ cardId, onClose, onDeleted }: Props) {
  return (
    <Sheet open={cardId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-5xl"
        data-testid="docket-panel"
      >
        {cardId ? (
          <CardPanelBody key={cardId} cardId={cardId} onDeleted={onDeleted} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
