import { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { Card } from "./docket-data"
import { refFromLink } from "./ref-from-link"
import {
  Adder,
  EmptyLine,
  ListRow,
  RemoveButton,
  Section,
} from "./SectionParts"

type Props = { card: Card; onChange: (card: Card) => void }

export function RefsSection({ card, onChange }: Props) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState(false)

  function add(done: () => void) {
    const ref = refFromLink(url.trim())
    if (!ref) {
      setError(true)
      return
    }
    onChange({ ...card, refs: [...card.refs, ref] })
    setUrl("")
    setError(false)
    done()
  }

  return (
    <Section title="Refs">
      {card.refs.length ? (
        card.refs.map((r, i) => (
          <ListRow key={`${r.system}-${i}`}>
            <Badge variant="secondary">{r.system}</Badge>
            {r.id ? <span className="shrink-0">{r.id}</span> : null}
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-muted-foreground underline-offset-4 hover:underline"
              >
                {r.label}
              </a>
            ) : (
              <span className="truncate text-muted-foreground">{r.label}</span>
            )}
            {r.syncedAgo ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.syncedAgo}
              </span>
            ) : null}
            <RemoveButton
              label={`Remove ref ${r.label}`}
              onClick={() =>
                onChange({
                  ...card,
                  refs: card.refs.filter((_, j) => j !== i),
                })
              }
            />
          </ListRow>
        ))
      ) : (
        <EmptyLine>No refs yet</EmptyLine>
      )}
      <Adder label="Add ref">
        {(done) => (
          <>
            <Input
              autoFocus
              value={url}
              aria-invalid={error}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(false)
              }}
              onKeyDown={(e) => e.key === "Enter" && add(done)}
              placeholder="https://..."
              aria-label="New ref URL"
            />
            <Button
              variant="outline"
              disabled={!url.trim()}
              onClick={() => add(done)}
            >
              Add
            </Button>
          </>
        )}
      </Adder>
    </Section>
  )
}
