import type { RunLibraryPin } from "@workspace/shared"
import { Pin } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FreshnessBadge } from "@/components/data/FreshnessBadge"
import { PageSection } from "@/components/page"
import { mono } from "@/components/data/mono"

type Props = { pins: RunLibraryPin[] }

export function RunLibraryPins({ pins }: Props) {
  return (
    <PageSection title="Library pins">
      {pins.length === 0 ? (
        <Empty
          className="ring-1 ring-foreground/10"
          data-testid="run-pins-empty"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Pin />
            </EmptyMedia>
            <EmptyTitle>No pins</EmptyTitle>
            <EmptyDescription>
              This run did not pull library entities.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table data-testid="run-library-pins">
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Revision</TableHead>
              <TableHead>Freshness</TableHead>
              <TableHead>Used by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pins.map((pin) => {
              const safeId = pin.entityId.replaceAll("/", "-")
              return (
                <TableRow
                  key={`${pin.connection}/${pin.kind}/${pin.entityId}`}
                  data-testid={`run-pin-${pin.connection}-${safeId}`}
                >
                  <TableCell>
                    <div>{pin.title}</div>
                    <div className={`${mono} text-xs text-muted-foreground`}>
                      {pin.connection}/{pin.kind}/{pin.entityId}
                    </div>
                  </TableCell>
                  <TableCell className={`${mono} text-sm`}>
                    {pin.revision}
                  </TableCell>
                  <TableCell>
                    <FreshnessBadge
                      fresh={pin.fresh}
                      data-testid={`run-pin-fresh-${safeId}`}
                    />
                  </TableCell>
                  <TableCell
                    className={`${mono} text-sm text-muted-foreground`}
                  >
                    {pin.usedByTaskIds.length > 0
                      ? pin.usedByTaskIds.join(", ")
                      : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </PageSection>
  )
}
