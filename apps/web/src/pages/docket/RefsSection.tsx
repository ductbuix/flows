import { useState } from "react"
import type { DocketRef } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { formatDate } from "./format-date"
import { refFromLink } from "./ref-from-link"
import {
  Adder,
  EmptyLine,
  ListRow,
  RemoveButton,
  Section,
} from "./SectionParts"

type Props = {
  refs: DocketRef[]
  onChange: (refs: DocketRef[]) => void
}

export function RefsSection({ refs, onChange }: Props) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState(false)

  function add(done: () => void) {
    const ref = refFromLink(url.trim())
    if (!ref) {
      setError(true)
      return
    }
    onChange([...refs, ref])
    setUrl("")
    setError(false)
    done()
  }

  return (
    <Section title="Refs">
      {refs.length ? (
        refs.map((r, i) => (
          <ListRow key={`${r.system}-${r.id ?? r.url ?? i}`}>
            <Badge variant="secondary">{r.system}</Badge>
            {r.id ? <span className="shrink-0">{r.id}</span> : null}
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-muted-foreground underline-offset-4 hover:underline"
              >
                {r.label ?? r.url}
              </a>
            ) : (
              <span className="truncate text-muted-foreground">
                {r.label ?? r.id ?? r.system}
              </span>
            )}
            {r.syncedAt ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(r.syncedAt)}
              </span>
            ) : null}
            <RemoveButton
              label={`Remove ref ${r.label ?? r.id ?? r.system}`}
              onClick={() => onChange(refs.filter((_, j) => j !== i))}
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
              data-testid="docket-ref-url"
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
              data-testid="docket-ref-add"
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
