import { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { Card } from "./docket-data"
import {
  Adder,
  EmptyLine,
  ListRow,
  RemoveButton,
  Section,
} from "./SectionParts"

const RELS = ["relates", "blocks", "parent", "duplicates"]

/** How a link reads from the target card's side. */
const BACKLINK: Record<string, string> = {
  relates: "related to",
  blocks: "blocked by",
  parent: "child of",
  duplicates: "duplicated by",
}

type Props = {
  card: Card
  allCards: Card[]
  onChange: (card: Card) => void
}

export function LinksSection({ card, allCards, onChange }: Props) {
  const [rel, setRel] = useState("relates")
  const [target, setTarget] = useState<string | null>(null)
  const others = allCards.filter((c) => c.id !== card.id)
  const title = (id: string) =>
    allCards.find((c) => c.id === id)?.title ?? `${id} (deleted)`
  const backlinks = allCards.flatMap((c) =>
    c.links
      .filter((l) => l.to === card.id)
      .map((l) => ({ from: c, rel: l.rel }))
  )

  return (
    <Section title="Links">
      {card.links.length ? (
        card.links.map((l) => (
          <ListRow key={`${l.rel}-${l.to}`}>
            <Badge variant="outline" className="shrink-0">
              {l.rel}
            </Badge>
            <span className="min-w-0 flex-1 truncate">{title(l.to)}</span>
            <RemoveButton
              label={`Remove link to ${title(l.to)}`}
              onClick={() =>
                onChange({
                  ...card,
                  links: card.links.filter((x) => x !== l),
                })
              }
            />
          </ListRow>
        ))
      ) : (
        <EmptyLine>No links yet</EmptyLine>
      )}
      {backlinks.map((b) => (
        <ListRow key={`${b.rel}-${b.from.id}`}>
          <Badge variant="secondary" className="shrink-0">
            {BACKLINK[b.rel] ?? b.rel}
          </Badge>
          <span className="min-w-0 flex-1 truncate">{b.from.title}</span>
        </ListRow>
      ))}
      <Adder label="Add link">
        {(done) => (
          <>
            <Select
              value={rel}
              items={RELS.map((r) => ({ value: r, label: r }))}
              onValueChange={(v) => v && setRel(v)}
            >
              <SelectTrigger aria-label="Relation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={target}
              items={others.map((c) => ({ value: c.id, label: c.title }))}
              onValueChange={setTarget}
            >
              <SelectTrigger aria-label="Target card">
                <SelectValue placeholder="Card" />
              </SelectTrigger>
              <SelectContent>
                {others.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!target}
              onClick={() => {
                if (!target) return
                onChange({
                  ...card,
                  links: [...card.links, { to: target, rel }],
                })
                setTarget(null)
                done()
              }}
            >
              Add
            </Button>
          </>
        )}
      </Adder>
    </Section>
  )
}
