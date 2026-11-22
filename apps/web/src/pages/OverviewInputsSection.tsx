import type { WorkflowInputDecl } from "@workspace/shared"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
import { PageSection } from "@/components/page"

type Props = { inputs: WorkflowInputDecl[] }

export function OverviewInputsSection({ inputs }: Props) {
  if (inputs.length === 0) {
    return (
      <PageSection title="Inputs">
        <Empty data-testid="overview-inputs-empty">
          <EmptyHeader>
            <EmptyTitle>No inputs</EmptyTitle>
            <EmptyDescription>
              This workflow has no declared start-run inputs.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageSection>
    )
  }
  return (
    <PageSection title="Inputs">
      <Table data-testid="overview-inputs">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Required</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inputs.map((input) => (
            <TableRow key={input.name}>
              <TableCell className="font-mono">{input.name}</TableCell>
              <TableCell>{input.type}</TableCell>
              <TableCell>{input.required ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PageSection>
  )
}
