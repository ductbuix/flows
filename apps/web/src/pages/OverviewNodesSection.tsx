import type { NodeWorkflow } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PageSection } from "@/components/page"
import { mono } from "@/components/data/mono"

type Node = NodeWorkflow["nodes"][number]

/** Agent CLI, or the Command line, in one short cell. */
function detail(node: Node): string | null {
  if (node.kind === "agent" || node.kind === "judge" || node.kind === "llm") {
    return node.cli
  }
  if (node.kind === "command") return node.run
  return null
}

function feedsLabel(workflow: NodeWorkflow, id: string): string {
  const from = workflow.edges.filter((e) => e.to === id).map((e) => e.from)
  return from.length === 0 ? "—" : [...new Set(from)].join(", ")
}

type Props = { workflow: NodeWorkflow }

/** Overview Tasks section for a node workflow: one row per node (BL-104). */
export function OverviewNodesSection({ workflow }: Props) {
  return (
    <PageSection title="Nodes">
      <Table data-testid="overview-nodes">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>Gets from</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflow.nodes.map((node) => {
            const d = detail(node)
            return (
              <TableRow key={node.id} data-testid={`overview-node-${node.id}`}>
                <TableCell>{node.name ?? node.id}</TableCell>
                <TableCell>
                  <Badge variant="outline">{node.kind}</Badge>
                </TableCell>
                <TableCell
                  className={`${mono} max-w-64 truncate text-muted-foreground`}
                >
                  {d ?? "—"}
                </TableCell>
                <TableCell className={`${mono} text-muted-foreground`}>
                  {feedsLabel(workflow, node.id)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </PageSection>
  )
}
