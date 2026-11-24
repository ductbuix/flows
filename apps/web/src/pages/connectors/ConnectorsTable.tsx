import type { ConnectorSummary } from "@workspace/contracts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { mono } from "@/components/data/mono"
import { authLabel } from "./connector-labels"
import { StatusBadge, TransportBadge } from "./connector-parts"

export function ConnectorsTable({
  items,
  onPick,
}: {
  items: ConnectorSummary[]
  onPick: (id: string) => void
}) {
  return (
    <Table data-testid="connector-table">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Connects via</TableHead>
          <TableHead>Sign-in</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer"
            onClick={() => onPick(c.id)}
            data-testid={`connector-row-${c.id}`}
          >
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{c.name}</span>
                <span
                  className={`${mono} max-w-64 truncate text-xs text-muted-foreground`}
                >
                  {c.how}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <TransportBadge transport={c.transport} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {authLabel(c.auth)}
            </TableCell>
            <TableCell>
              <StatusBadge status={c.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
