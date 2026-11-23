import { Badge } from "@workspace/ui/components/badge"
import type { Card } from "./docket-data"
import { EmptyLine, Row, Section } from "./SectionParts"

/** Read-only properties copied from each ref's external item. */
export function RefDataSection({ card }: { card: Card }) {
  const withData = card.refs.filter((r) => r.data)
  return (
    <Section title="Ref data">
      {withData.length ? (
        withData.map((r, i) => (
          <div key={`${r.system}-${i}`} className="flex flex-col gap-0.5">
            <div className="flex min-h-8 items-center gap-2">
              <Badge variant="secondary">{r.system}</Badge>
              <span>{r.id ?? r.label}</span>
              {r.syncedAgo ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  Synced {r.syncedAgo}
                </span>
              ) : null}
            </div>
            {Object.entries(r.data ?? {}).map(([k, v]) => (
              <Row key={k} label={k}>
                <span className="truncate">{v}</span>
              </Row>
            ))}
          </div>
        ))
      ) : (
        <>
          <EmptyLine />
          <p className="text-xs text-muted-foreground">
            A connector fills this from the ref when it syncs.
          </p>
        </>
      )}
    </Section>
  )
}
