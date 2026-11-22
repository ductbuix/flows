import type { LibraryEntity } from "@workspace/shared"
import { FreshnessBadge } from "@/components/data/FreshnessBadge"
import { PageSection } from "@/components/page"

type Props = {
  entities: LibraryEntity[]
}

export function ConnectionLocalData({ entities }: Props) {
  return (
    <PageSection title="Local data">
      {entities.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="connection-local-empty"
        >
          Nothing pulled yet for this connection.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="connection-local">
          {entities.map((entity) => (
            <li
              key={`${entity.kind}/${entity.entityId}`}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span>
                {entity.title}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {entity.kind}/{entity.entityId}
                </span>
              </span>
              <FreshnessBadge fresh={entity.fresh} />
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  )
}
