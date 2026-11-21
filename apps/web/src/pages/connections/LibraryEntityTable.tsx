import type { LibraryEntity } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FreshnessBadge } from "@/components/FreshnessBadge"

function pinnedBy(entity: LibraryEntity): string {
  const ids = new Set<string>()
  for (const rev of entity.revisions) {
    for (const runId of rev.pinningRunIds) ids.add(runId)
  }
  if (ids.size === 0) return "—"
  return [...ids].sort().join(", ")
}

function revisionLabel(entity: LibraryEntity): string {
  const current = entity.revisions.find((r) => r.current)
  if (!current) return "—"
  const count = entity.revisions.length
  return count === 1
    ? current.revision
    : `${current.revision} (${count} revisions)`
}

export function clearableCount(entity: LibraryEntity): number {
  return entity.revisions.filter(
    (r) => !r.current && r.pinningRunIds.length === 0
  ).length
}

type Props = {
  entities: LibraryEntity[]
  busy: string | null
  onPull: (entity: LibraryEntity) => void
  onClear: (entity: LibraryEntity) => void
}

export function LibraryEntityTable({ entities, busy, onPull, onClear }: Props) {
  return (
    <Table data-testid="library-table">
      <TableHeader>
        <TableRow>
          <TableHead>Entity</TableHead>
          <TableHead>Connection</TableHead>
          <TableHead>Revision</TableHead>
          <TableHead>Freshness</TableHead>
          <TableHead>Pinned by</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entities.map((entity) => {
          const id = `${entity.connection}/${entity.kind}/${entity.entityId}`
          const clearable = clearableCount(entity)
          return (
            <TableRow
              key={id}
              data-testid={`library-row-${entity.connection}-${entity.entityId}`}
            >
              <TableCell>
                <div>{entity.title}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {entity.kind}/{entity.entityId}
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {entity.connection}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {revisionLabel(entity)}
              </TableCell>
              <TableCell>
                <FreshnessBadge
                  fresh={entity.fresh}
                  data-testid={`library-fresh-${entity.entityId}`}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {pinnedBy(entity)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`library-pull-${entity.entityId}`}
                    disabled={busy === `pull:${id}`}
                    onClick={() => onPull(entity)}
                  >
                    Pull now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`library-clear-${entity.entityId}`}
                    disabled={clearable === 0 || busy === `clear:${id}`}
                    onClick={() => onClear(entity)}
                  >
                    Clear unused
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
