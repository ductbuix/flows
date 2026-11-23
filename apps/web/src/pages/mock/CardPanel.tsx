import { useState } from "react"
import { MoreHorizontal, SquareKanban, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { CardRunsSection } from "./CardRunsSection"
import { AssetsSection } from "./AssetsSection"
import { MOCK_TODAY, formatDate, type Card } from "./docket-data"
import { InlineText } from "./InlineText"
import { LinksSection } from "./LinksSection"
import { PropertiesSection } from "./PropertiesSection"
import { RefDataSection } from "./RefDataSection"
import { RefsSection } from "./RefsSection"
import { Section } from "./SectionParts"

type Props = {
  card: Card | null
  allCards: Card[]
  onChange: (card: Card) => void
  onDelete: (id: string) => void
  onClose: () => void
}

/** Side sheet: every edit saves at once (mock: in memory). */
export function CardPanel({
  card,
  allCards,
  onChange,
  onDelete,
  onClose,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const save = (next: Card) => onChange({ ...next, updated: MOCK_TODAY })

  return (
    <Sheet open={card !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-5xl"
        data-testid="docket-panel"
      >
        {card ? (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between pr-8 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <SquareKanban className="size-4" />
                  Card
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Card actions"
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      data-testid="docket-delete"
                      onClick={() => setConfirming(true)}
                    >
                      <Trash2 />
                      Delete card
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <SheetTitle className="sr-only">{card.title}</SheetTitle>
              <InlineText
                label="title"
                placeholder="Untitled"
                className="font-heading text-xl font-medium"
                value={card.title}
                onSave={(v) => save({ ...card, title: v })}
              />
              <SheetDescription>
                {card.id} · Updated {formatDate(card.updated)}
              </SheetDescription>
            </SheetHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto border-t md:grid-cols-3 md:overflow-hidden">
              <div className="flex flex-col gap-4 overflow-y-auto p-4 md:col-span-2 md:border-r">
                <RefsSection card={card} onChange={save} />
                <PropertiesSection card={card} onChange={save} />
                <Section title="Description">
                  <InlineText
                    multiline
                    label="description"
                    placeholder="Add a description"
                    value={card.body}
                    onSave={(v) => save({ ...card, body: v })}
                  />
                </Section>
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                  <CardRunsSection card={card} />
                  <LinksSection
                    card={card}
                    allCards={allCards}
                    onChange={save}
                  />
                  <AssetsSection card={card} />
                  <div className="border-t pt-4">
                    <RefDataSection card={card} />
                  </div>
                </div>
              </div>
            </div>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Delete this card?"
              description="The card and its owned assets are removed. Linked files stay where they are."
              confirmLabel="Delete"
              onConfirm={() => {
                setConfirming(false)
                onDelete(card.id)
              }}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
