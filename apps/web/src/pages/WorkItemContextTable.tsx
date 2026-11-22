import type { LibraryEntity, WorkItemLink } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FreshnessBadge } from "@/components/data/FreshnessBadge"
import { mono } from "@/components/data/mono"

export function linkKey(link: WorkItemLink): string {
  return `${link.connection}/${link.kind}/${link.entityId}`
}

export function entityKey(entity: LibraryEntity): string {
  return `${entity.connection}/${entity.kind}/${entity.entityId}`
}

type Props = {
  links: WorkItemLink[]
  entities: LibraryEntity[]
  busy: boolean
  onRemove: (link: WorkItemLink) => void
}

export function WorkItemContextTable({
  links,
  entities,
  busy,
  onRemove,
}: Props) {
  const freshness = new Map(entities.map((e) => [entityKey(e), e.fresh]))
  const titles = new Map(entities.map((e) => [entityKey(e), e.title]))

  return (
    <Table data-testid="work-item-context">
      <TableHeader>
        <TableRow>
          <TableHead>Entity</TableHead>
          <TableHead>Connection</TableHead>
          <TableHead>Freshness</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {links.map((link) => {
          const key = linkKey(link)
          return (
            <TableRow key={key} data-testid={`work-item-link-${link.entityId}`}>
              <TableCell>
                <div>{titles.get(key) ?? link.entityId}</div>
                <div className={`${mono} text-xs text-muted-foreground`}>
                  {link.kind}/{link.entityId}
                </div>
              </TableCell>
              <TableCell className={`${mono} text-sm`}>
                {link.connection}
              </TableCell>
              <TableCell>
                <FreshnessBadge
                  fresh={freshness.get(key) ?? false}
                  data-testid={`work-item-fresh-${link.entityId}`}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  data-testid={`work-item-unlink-${link.entityId}`}
                  onClick={() => onRemove(link)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
