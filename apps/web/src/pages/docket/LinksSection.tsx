import { useState } from "react"
import { cardLinkRelSchema, type CardLink } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Adder,
  EmptyLine,
  ListRow,
  RemoveButton,
  Section,
} from "./SectionParts"

const RELS = cardLinkRelSchema.options

/** How a link reads from the target card's side. */
const BACKLINK: Record<string, string> = {
  relates: "related to",
  blocks: "blocked by",
  parent: "child of",
  duplicates: "duplicated by",
}

export type CardOption = { id: string; title: string }

export type CardBacklink = { from: string; rel: string }

type Props = {
  cardId: string
  links: CardLink[]
  backlinks: CardBacklink[]
  allCards: CardOption[]
  onChange: (links: CardLink[]) => void
}

export function LinksSection({
  cardId,
  links,
  backlinks,
  allCards,
  onChange,
}: Props) {
  const [rel, setRel] = useState<(typeof RELS)[number]>("relates")
  const [target, setTarget] = useState<string | null>(null)
  const others = allCards.filter((c) => c.id !== cardId)
  const title = (id: string) =>
    allCards.find((c) => c.id === id)?.title ?? `${id} (deleted)`

  return (
    <Section title="Links">
      {links.length ? (
        links.map((l) => (
          <ListRow key={`${l.rel}-${l.to}`}>
            <Badge variant="outline" className="shrink-0">
              {l.rel}
            </Badge>
            <span className="min-w-0 flex-1 truncate">{title(l.to)}</span>
            <RemoveButton
              label={`Remove link to ${title(l.to)}`}
              onClick={() =>
                onChange(
                  links.filter((x) => !(x.to === l.to && x.rel === l.rel))
                )
              }
            />
          </ListRow>
        ))
      ) : (
        <EmptyLine>No links yet</EmptyLine>
      )}
      {backlinks.map((b) => (
        <ListRow key={`${b.rel}-${b.from}`}>
          <Badge variant="secondary" className="shrink-0">
            {BACKLINK[b.rel] ?? b.rel}
          </Badge>
          <span className="min-w-0 flex-1 truncate">{title(b.from)}</span>
        </ListRow>
      ))}
      <Adder label="Add link">
        {(done) => (
          <>
            <Select
              value={rel}
              items={RELS.map((r) => ({ value: r, label: r }))}
              onValueChange={(v) => v && setRel(v as (typeof RELS)[number])}
            >
              <SelectTrigger
                aria-label="Relation"
                data-testid="docket-link-rel"
              >
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
              <SelectTrigger
                aria-label="Target card"
                data-testid="docket-link-target"
              >
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
              data-testid="docket-link-add"
              onClick={() => {
                if (!target) return
                onChange([...links, { to: target, rel }])
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
