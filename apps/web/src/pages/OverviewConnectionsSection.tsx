import { Plug } from "lucide-react"
import type { Workflow } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
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
import { ImpactBadge } from "@/components/ImpactBadge"
import { PageSection } from "@/components/page"
import {
  overviewConnections,
  overviewImpacts,
} from "@/pages/overview-connections"

type Props = { workflow: Workflow }

export function OverviewConnectionsSection({ workflow }: Props) {
  const connections = overviewConnections(workflow)
  const impacts = overviewImpacts(workflow)

  return (
    <PageSection title="Connections">
      <div className="flex flex-col gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="overview-impact"
        >
          <span className="text-sm text-muted-foreground">Impact</span>
          {impacts.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            impacts.map((impact) => (
              <ImpactBadge
                key={impact}
                impact={impact}
                data-testid={`overview-impact-${impact}`}
              />
            ))
          )}
        </div>
        {connections.length === 0 ? (
          <Empty className="border" data-testid="overview-connections-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Plug />
              </EmptyMedia>
              <EmptyTitle>No connections</EmptyTitle>
              <EmptyDescription>
                Add connections on tasks in the Editor.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table data-testid="overview-connections">
            <TableHeader>
              <TableRow>
                <TableHead>Connection</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((row) => (
                <TableRow key={row.connection}>
                  <TableCell className="font-mono">{row.connection}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {row.access === "read"
                        ? "Read"
                        : row.access === "propose"
                          ? "Propose"
                          : "Publish"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {row.taskIds.join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </PageSection>
  )
}
