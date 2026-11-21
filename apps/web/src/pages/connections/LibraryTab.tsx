import { useEffect, useState } from "react"
import { libraryListSchema, type LibraryEntity } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "sonner"
import { FreshnessBadge } from "@/components/FreshnessBadge"
import { Section } from "@/components/Section"
import { api } from "@/lib/api"

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

export function LibraryTab() {
  const [entities, setEntities] = useState<LibraryEntity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pulling, setPulling] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await api.library.$get()
      if (!res.ok) throw new Error("failed")
      const body = libraryListSchema.parse(await res.json())
      setEntities(body.entities)
    } catch {
      setError("Could not load library.")
      setEntities([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function pull(entity: LibraryEntity) {
    const key = `${entity.connection}/${entity.kind}/${entity.entityId}`
    setPulling(key)
    try {
      const res = await api.library.pull.$post({
        json: {
          connection: entity.connection,
          kind: entity.kind,
          entityId: entity.entityId,
        },
      })
      if (!res.ok) {
        toast.error("Pull failed")
        return
      }
      toast.success("Pulled")
      await load()
    } catch {
      toast.error("Pull failed")
    } finally {
      setPulling(null)
    }
  }

  return (
    <Section title="Library">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : entities === null ? (
        <div className="space-y-3" data-testid="library-loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : entities.length === 0 ? (
        <Empty data-testid="library-empty">
          <EmptyHeader>
            <EmptyTitle>Nothing pulled yet</EmptyTitle>
            <EmptyDescription>
              Pull from a connection to see entities and revisions here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
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
              const key = `${entity.connection}/${entity.kind}/${entity.entityId}`
              return (
                <TableRow
                  key={key}
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
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`library-pull-${entity.entityId}`}
                      disabled={pulling === key}
                      onClick={() => void pull(entity)}
                    >
                      Pull now
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Section>
  )
}
