import type { DocketRef } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { RelativeTime } from "@/components/data/RelativeTime"
import { EmptyLine, Row, Section } from "./SectionParts"

type RefWithData = DocketRef & {
  data?: Record<string, unknown>
}

function stringEntries(
  data: Record<string, unknown>
): { key: string; value: string }[] {
  return Object.entries(data).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }))
}

/** Read-only properties copied from each ref’s external item (DK-14). */
export function RefDataSection({ refs }: { refs: DocketRef[] }) {
  const withData = (refs as RefWithData[]).filter(
    (r) => r.data && Object.keys(r.data).length > 0
  )
  return (
    <Section title="Ref data">
      {withData.length ? (
        withData.map((r, i) => (
          <div
            key={`${r.system}-${r.id ?? r.url ?? i}`}
            className="flex flex-col gap-0.5"
            data-testid="ref-data-block"
          >
            <div className="flex min-h-8 items-center gap-2">
              <Badge variant="secondary">{r.system}</Badge>
              <span>{r.id ?? r.label}</span>
              {r.syncedAt ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  Synced <RelativeTime value={r.syncedAt} />
                </span>
              ) : null}
            </div>
            {stringEntries(r.data!).map(({ key, value }) => (
              <Row key={key} label={key}>
                <span className="truncate">{value}</span>
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
