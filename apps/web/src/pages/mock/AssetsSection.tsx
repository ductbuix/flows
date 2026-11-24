import { useState } from "react"
import { HardDriveUpload } from "lucide-react"
import { useNavigate } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import type { Card } from "./docket-data"
import { AddLibraryDialog } from "./AddLibraryDialog"
import { linkCard, unlinkCard, useLibrary } from "./library-store"
import { KindIcon } from "./LibraryViews"
import {
  Adder,
  EmptyLine,
  ListRow,
  RemoveButton,
  Section,
} from "./SectionParts"
import { KIND_SINGULAR, type LibItem } from "./library-data"

/** Assets of a card are Library items. Opening one goes to the Library page. */
export function AssetsSection({ card }: { card: Card }) {
  const items = useLibrary()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const mine = items.filter((i) => i.usedBy.includes(card.id))
  const rest = items.filter((i) => !i.usedBy.includes(card.id))
  return (
    <Section title="Assets">
      {mine.length ? (
        mine.map((i) => (
          <ListRow
            key={i.id}
            onOpen={() => void navigate(`/library?item=${i.id}`)}
          >
            <KindIcon
              kind={i.kind}
              className="shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate">{i.title}</span>
            {i.source !== "local" ? (
              <Badge variant="secondary">v{i.current}</Badge>
            ) : null}
            <RemoveButton
              label={`Unlink ${i.title}`}
              onClick={() => unlinkCard(i.id, card.id)}
            />
          </ListRow>
        ))
      ) : (
        <EmptyLine>No assets yet</EmptyLine>
      )}
      <Adder label="Add asset">
        {(done) => (
          <Combobox
            defaultOpen
            items={rest}
            value={null}
            onValueChange={(i: LibItem | null) => {
              if (!i) return
              linkCard(i.id, card.id)
              done()
            }}
            itemToStringLabel={(i: LibItem) => i.title}
            itemToStringValue={(i: LibItem) => i.id}
          >
            <ComboboxInput
              autoFocus
              aria-label="Asset from the Library"
              placeholder="Search the Library"
              data-testid="asset-picker"
              className="w-full"
            />
            <ComboboxContent align="end" className="w-80">
              <ComboboxEmpty>Nothing else in the Library</ComboboxEmpty>
              <ComboboxList>
                {(i: LibItem) => (
                  <ComboboxItem key={i.id} value={i}>
                    <KindIcon kind={i.kind} />
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {KIND_SINGULAR[i.kind]}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setAdding(true)
                    done()
                  }}
                  data-testid="asset-add-from-disk"
                >
                  <HardDriveUpload />
                  Add from disk…
                </Button>
              </div>
            </ComboboxContent>
          </Combobox>
        )}
      </Adder>
      <AddLibraryDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={(id) => linkCard(id, card.id)}
      />
    </Section>
  )
}
